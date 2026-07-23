import { describe, expect, it } from "vitest";
import {
  bearingToDirection8,
  haversineMeters,
  lngLatToTile,
  metersToWalkMinutes,
  tilesCoveringRadius,
  TILE_ZOOM,
} from "@/lib/reinfolib/tiles";
import {
  filterByWalkAndDirection,
  normalizePoint,
  parseAreaStr,
  parseYearStr,
  parseYenFromManStr,
} from "@/lib/aggregate/normalize-point";
import type { PointFeature } from "@/lib/reinfolib/points-client";
import { findNearestStation, findStation } from "@/lib/stations/lookup";
import { cityBounds, listDistricts } from "@/lib/districts/lookup";
import { tilesCoveringBounds } from "@/lib/reinfolib/tiles";

const OFUNA = { lng: 139.531334, lat: 35.353631 };

describe("tiles", () => {
  it("lngLatToTile は z=13 で妥当なタイルを返す", () => {
    const t = lngLatToTile(OFUNA.lng, OFUNA.lat);
    expect(t.z).toBe(TILE_ZOOM);
    expect(t.x).toBeGreaterThan(0);
    expect(t.y).toBeGreaterThan(0);
  });
  it("半径を覆うタイルは中心タイルを含む", () => {
    const center = lngLatToTile(OFUNA.lng, OFUNA.lat);
    const tiles = tilesCoveringRadius(OFUNA.lng, OFUNA.lat, 1600);
    expect(tiles.some((t) => t.x === center.x && t.y === center.y)).toBe(true);
    expect(tiles.length).toBeGreaterThanOrEqual(1);
    expect(tiles.length).toBeLessThanOrEqual(9); // 徒歩20分でも数枚に収まる
  });
});

describe("haversine / walk minutes", () => {
  it("同一点は0m", () => {
    expect(haversineMeters(OFUNA.lng, OFUNA.lat, OFUNA.lng, OFUNA.lat)).toBeCloseTo(0);
  });
  it("大船〜鎌倉は約4km台", () => {
    const m = haversineMeters(OFUNA.lng, OFUNA.lat, 139.550352, 35.319054);
    expect(m).toBeGreaterThan(3500);
    expect(m).toBeLessThan(5000);
  });
  it("800mは徒歩10分（切り上げ）", () => {
    expect(metersToWalkMinutes(800)).toBe(10);
    expect(metersToWalkMinutes(801)).toBe(11);
  });
});

describe("bearingToDirection8", () => {
  it("真北・真東・真南・真西", () => {
    expect(bearingToDirection8(139.5, 35.0, 139.5, 35.1)).toBe("北");
    expect(bearingToDirection8(139.5, 35.0, 139.6, 35.0)).toBe("東");
    expect(bearingToDirection8(139.5, 35.0, 139.5, 34.9)).toBe("南");
    expect(bearingToDirection8(139.5, 35.0, 139.4, 35.0)).toBe("西");
  });
});

describe("XPT001 パーサ", () => {
  it("万円・億円", () => {
    expect(parseYenFromManStr("1,900万円")).toBe(19_000_000);
    expect(parseYenFromManStr("1億2,000万円")).toBe(120_000_000);
    expect(parseYenFromManStr("")).toBeNull();
  });
  it("面積（端値は除外）", () => {
    expect(parseAreaStr("70㎡")).toBe(70);
    expect(parseAreaStr("2,000㎡以上")).toBeNull();
    expect(parseAreaStr("")).toBeNull();
  });
  it("築年", () => {
    expect(parseYearStr("1988年")).toBe(1988);
    expect(parseYearStr("")).toBeNull();
  });
});

function pointFeature(overrides: Partial<PointFeature["properties"]>): PointFeature {
  return {
    // geometry は最寄り駅の点（distance計算には使わない）。ダミーでよい
    geometry: { type: "Point", coordinates: [OFUNA.lng, OFUNA.lat] },
    properties: {
      point_in_time_name_ja: "2024年第2四半期",
      land_type_name_ja: "中古マンション等",
      price_information_category_name_ja: "成約価格情報",
      prefecture_name_ja: "神奈川県",
      city_code: "14204",
      city_name_ja: "鎌倉市",
      district_name_ja: "大船", // districts.json に存在する町丁目
      u_transaction_price_total_ja: "3,000万円",
      u_area_ja: "60㎡",
      u_construction_year_ja: "2000年",
      building_structure_name_ja: "ＲＣ",
      floor_plan_name_ja: "３ＬＤＫ",
      ...overrides,
    },
  };
}

describe("normalizePoint", () => {
  it("駅検索モード: 検索駅からの距離・方位を付与する", () => {
    const d = normalizePoint(pointFeature({}), { lng: OFUNA.lng, lat: OFUNA.lat });
    expect(d?.tradePrice).toBe(30_000_000);
    expect(d?.unitPrice).toBe(500_000);
    expect(d?.walkMinutes).toBeGreaterThan(0);
    expect(d?.direction).toBeDefined();
  });
  it("最寄駅名・最寄駅徒歩は検索モードに関わらず付与される（geometry=最寄駅座標から逆引き）", () => {
    const d = normalizePoint(pointFeature({}));
    expect(d?.nearestStation).toBe("大船");
    expect(d?.nearestStationWalk).toBeGreaterThan(0);
    // 市区町村検索（searchStation未指定）では検索駅基準の距離は付かない
    expect(d?.walkMinutes).toBeUndefined();
    expect(d?.direction).toBeUndefined();
  });
  it("価格・面積欠損は捨てる", () => {
    expect(normalizePoint(pointFeature({ u_transaction_price_total_ja: "" }))).toBeNull();
  });
  it("centroidが引けない町丁目は距離系フィールドが付かない", () => {
    const d = normalizePoint(pointFeature({ city_code: "99999", district_name_ja: "存在しない町" }), {
      lng: OFUNA.lng,
      lat: OFUNA.lat,
    });
    expect(d?.walkMinutes).toBeUndefined();
    expect(d?.direction).toBeUndefined();
    expect(d?.nearestStation).toBeUndefined();
  });
  it("全角の間取り・構造を半角に正規化する", () => {
    const d = normalizePoint(pointFeature({ floor_plan_name_ja: "３ＬＤＫ", building_structure_name_ja: "ＲＣ" }));
    expect(d?.floorPlan).toBe("3LDK");
    expect(d?.structure).toBe("RC");
  });
});

describe("filterByWalkAndDirection", () => {
  const base = normalizePoint(pointFeature({}), { lng: OFUNA.lng, lat: OFUNA.lat })!;
  it("徒歩上限で絞る（駅検索モード）", () => {
    const opts = { walkMaxMinutes: 20, directions: [], useSearchStationDistance: true };
    expect(filterByWalkAndDirection([{ ...base, walkMinutes: 25 }], opts)).toHaveLength(0);
    expect(filterByWalkAndDirection([{ ...base, walkMinutes: 10 }], opts)).toHaveLength(1);
  });
  it("徒歩なし(null)なら距離不明でも通す", () => {
    const opts = { walkMaxMinutes: undefined, directions: [], useSearchStationDistance: true };
    expect(filterByWalkAndDirection([{ ...base, walkMinutes: undefined }], opts)).toHaveLength(1);
  });
  it("市区町村モードは最寄駅距離(nearestStationWalk)で絞る", () => {
    const opts = { walkMaxMinutes: 10, directions: [], useSearchStationDistance: false };
    expect(filterByWalkAndDirection([{ ...base, nearestStationWalk: 5 }], opts)).toHaveLength(1);
    expect(filterByWalkAndDirection([{ ...base, nearestStationWalk: 15 }], opts)).toHaveLength(0);
  });
  it("方角で絞る（空なら全通過）", () => {
    const opts = (directions: string[]) => ({ walkMaxMinutes: 30, directions, useSearchStationDistance: true });
    expect(filterByWalkAndDirection([{ ...base, direction: "北" }], opts(["南"]))).toHaveLength(0);
    expect(filterByWalkAndDirection([{ ...base, direction: "北" }], opts([]))).toHaveLength(1);
    expect(filterByWalkAndDirection([{ ...base, direction: "北" }], opts(["北", "北東"]))).toHaveLength(1);
  });
});

describe("findNearestStation", () => {
  it("駅の座標そのものは自駅に一致する", () => {
    const kamakura = findStation("005055")!;
    const r = findNearestStation(kamakura.lng, kamakura.lat);
    expect(r?.station.name).toBe("鎌倉");
    expect(r?.meters).toBeCloseTo(0, 0);
  });
  it("遠く離れた座標（海外相当）は一致なし", () => {
    expect(findNearestStation(0, 0)).toBeNull();
  });
});

describe("listDistricts / cityBounds", () => {
  it("藤沢市(14205)の地区一覧が取れる", () => {
    const ds = listDistricts("14205");
    expect(ds.length).toBeGreaterThan(50);
    expect(ds).toContain("鵠沼海岸");
  });
  it("存在しない市はゼロ件・null", () => {
    expect(listDistricts("99999")).toHaveLength(0);
    expect(cityBounds("99999")).toBeNull();
  });
  it("市のbboxは妥当な緯度経度範囲を返す", () => {
    const b = cityBounds("14205")!;
    expect(b.minLat).toBeLessThan(b.maxLat);
    expect(b.minLng).toBeLessThan(b.maxLng);
    expect(b.minLat).toBeGreaterThan(35);
    expect(b.maxLat).toBeLessThan(36);
  });
});

describe("tilesCoveringBounds", () => {
  it("市規模のbboxを少数タイルで覆う", () => {
    const b = cityBounds("14205")!;
    const tiles = tilesCoveringBounds(b);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(30);
  });
});
