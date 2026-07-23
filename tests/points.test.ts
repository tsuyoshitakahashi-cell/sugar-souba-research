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
  it("町丁目centroidから距離・方位を付与する", () => {
    const d = normalizePoint(pointFeature({}), OFUNA.lng, OFUNA.lat);
    expect(d?.tradePrice).toBe(30_000_000);
    expect(d?.unitPrice).toBe(500_000);
    expect(d?.walkMinutes).toBeGreaterThan(0);
    expect(d?.direction).toBeDefined();
  });
  it("価格・面積欠損は捨てる", () => {
    expect(normalizePoint(pointFeature({ u_transaction_price_total_ja: "" }), OFUNA.lng, OFUNA.lat)).toBeNull();
  });
  it("centroidが引けない町丁目は距離・方位が付かない", () => {
    const d = normalizePoint(pointFeature({ city_code: "99999", district_name_ja: "存在しない町" }), OFUNA.lng, OFUNA.lat);
    expect(d?.walkMinutes).toBeUndefined();
    expect(d?.direction).toBeUndefined();
  });
});

describe("filterByWalkAndDirection", () => {
  const base = normalizePoint(pointFeature({}), OFUNA.lng, OFUNA.lat)!;
  it("徒歩上限で絞る", () => {
    expect(filterByWalkAndDirection([{ ...base, walkMinutes: 25 }], { walkMaxMinutes: 20, directions: [] })).toHaveLength(0);
    expect(filterByWalkAndDirection([{ ...base, walkMinutes: 10 }], { walkMaxMinutes: 20, directions: [] })).toHaveLength(1);
  });
  it("方角で絞る（空なら全通過）", () => {
    expect(filterByWalkAndDirection([{ ...base, direction: "北" }], { walkMaxMinutes: 30, directions: ["南"] })).toHaveLength(0);
    expect(filterByWalkAndDirection([{ ...base, direction: "北" }], { walkMaxMinutes: 30, directions: [] })).toHaveLength(1);
    expect(filterByWalkAndDirection([{ ...base, direction: "北" }], { walkMaxMinutes: 30, directions: ["北", "北東"] })).toHaveLength(1);
  });
});
