import type { PointFeature } from "@/lib/reinfolib/points-client";
import { bearingToDirection8, haversineMeters, metersToWalkMinutes } from "@/lib/reinfolib/tiles";
import { findDistrictCentroid } from "@/lib/districts/lookup";
import { findNearestStation } from "@/lib/stations/lookup";
import { zenkakuToHankaku, type Deal } from "./normalize";

// XPT001 の整形文字列パーサ。該当なし・端値は null。
export function parseYenFromManStr(s: string): number | null {
  // 「1,900万円」「1億2,000万円」等
  const cleaned = s.replace(/,/g, "");
  const oku = cleaned.match(/([\d.]+)億/);
  const man = cleaned.match(/([\d.]+)万円/);
  if (!oku && !man) return null;
  let yen = 0;
  if (oku) yen += Number(oku[1]) * 100_000_000;
  if (man) yen += Number(man[1]) * 10_000;
  return yen > 0 ? yen : null;
}

export function parseAreaStr(s: string): number | null {
  // 「70㎡」。「2000㎡以上」等の端値は除外（相場集計を歪めるため）
  if (s.includes("以上") || s.includes("以下")) return null;
  const m = s.replace(/,/g, "").match(/([\d.]+)㎡/);
  return m ? Number(m[1]) : null;
}

export function parseYearStr(s: string): number | null {
  const m = s.match(/(\d{4})年/);
  return m ? Number(m[1]) : null;
}

// PointFeature を Deal へ正規化。
// XPT001 の geometry 座標は「物件の最寄り駅の点」で物件位置ではない。
// - 全モード共通: geometry座標 → stations.json逆引きで「最寄駅名」を得て、
//   最寄駅座標 → 町丁目centroid（位置参照情報）の距離を「最寄駅からの概算徒歩分」とする。
// - 駅検索モードのみ: 検索した駅座標(searchStation) → 町丁目centroid の距離・方位を別途付与する
//   （既存の walkMinutes/direction。検索駅が最寄駅と異なる場合もあるため区別する）。
// centroid が引けない町丁目は距離系フィールドをすべて undefined にする。
export function normalizePoint(
  feature: PointFeature,
  searchStation?: { lng: number; lat: number },
): Deal | null {
  const p = feature.properties;
  const tradePrice = parseYenFromManStr(p.u_transaction_price_total_ja);
  const area = parseAreaStr(p.u_area_ja);
  if (tradePrice === null || area === null || area <= 0) return null;

  const centroid = findDistrictCentroid(p.city_code, p.district_name_ja);

  let walkMinutes: number | undefined;
  let direction: string | undefined;
  let nearestStation: string | undefined;
  let nearestStationWalk: number | undefined;

  if (centroid) {
    const [dLat, dLng] = centroid;
    if (searchStation) {
      walkMinutes = metersToWalkMinutes(haversineMeters(searchStation.lng, searchStation.lat, dLng, dLat));
      direction = bearingToDirection8(searchStation.lng, searchStation.lat, dLng, dLat);
    }
    const [nearestLng, nearestLat] = feature.geometry.coordinates;
    const nearest = findNearestStation(nearestLng, nearestLat);
    if (nearest) {
      nearestStation = nearest.station.name;
      nearestStationWalk = metersToWalkMinutes(
        haversineMeters(nearest.station.lng, nearest.station.lat, dLng, dLat),
      );
    }
  }

  return {
    priceCategory: p.price_information_category_name_ja === "成約価格情報" ? "成約" : "取引",
    type: p.land_type_name_ja,
    prefecture: p.prefecture_name_ja,
    municipality: p.city_name_ja,
    district: p.district_name_ja,
    tradePrice,
    area,
    unitPrice: tradePrice / area,
    builtYear: parseYearStr(p.u_construction_year_ja),
    floorPlan: zenkakuToHankaku(p.floor_plan_name_ja),
    structure: zenkakuToHankaku(p.building_structure_name_ja),
    period: p.point_in_time_name_ja,
    walkMinutes,
    direction,
    nearestStation,
    nearestStationWalk,
  };
}

export interface PointFilter {
  walkMaxMinutes?: number; // 未指定なら徒歩で絞らない
  directions: string[]; // 空 = 全方位
  // true: 検索駅からの距離(walkMinutes)で絞る（駅検索モード）
  // false: 最寄駅からの距離(nearestStationWalk)で絞る（市区町村検索モード）
  useSearchStationDistance: boolean;
}

export function filterByWalkAndDirection(deals: Deal[], f: PointFilter): Deal[] {
  return deals.filter((d) => {
    const minutes = f.useSearchStationDistance ? d.walkMinutes : d.nearestStationWalk;
    if (f.walkMaxMinutes !== undefined) {
      // 町丁目centroidが引けず距離不明な物件は、徒歩条件がある場合は除外する（概算でも位置づけられないため）
      if (minutes === undefined) return false;
      if (minutes > f.walkMaxMinutes) return false;
    }
    if (f.directions.length > 0 && (!d.direction || !f.directions.includes(d.direction))) return false;
    return true;
  });
}
