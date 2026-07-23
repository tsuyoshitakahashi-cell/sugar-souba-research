import type { PointFeature } from "@/lib/reinfolib/points-client";
import { bearingToDirection8, haversineMeters, metersToWalkMinutes } from "@/lib/reinfolib/tiles";
import { findDistrictCentroid } from "@/lib/districts/lookup";
import type { Deal } from "./normalize";

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
// XPT001 の geometry 座標は「物件の最寄り駅の点」で物件位置ではないため使わない。
// 距離・方角は駅座標 → 町丁目centroid（位置参照情報）で概算する。
// centroid が引けない町丁目は walkMinutes/direction を undefined にする（route側で扱いを決める）。
export function normalizePoint(
  feature: PointFeature,
  stationLng: number,
  stationLat: number,
): Deal | null {
  const p = feature.properties;
  const tradePrice = parseYenFromManStr(p.u_transaction_price_total_ja);
  const area = parseAreaStr(p.u_area_ja);
  if (tradePrice === null || area === null || area <= 0) return null;

  const centroid = findDistrictCentroid(p.city_code, p.district_name_ja);
  let walkMinutes: number | undefined;
  let direction: string | undefined;
  if (centroid) {
    const [dLat, dLng] = centroid;
    walkMinutes = metersToWalkMinutes(haversineMeters(stationLng, stationLat, dLng, dLat));
    direction = bearingToDirection8(stationLng, stationLat, dLng, dLat);
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
    floorPlan: p.floor_plan_name_ja,
    structure: p.building_structure_name_ja,
    period: p.point_in_time_name_ja,
    walkMinutes,
    direction,
  };
}

export interface PointFilter {
  walkMaxMinutes: number;
  directions: string[]; // 空 = 全方位
}

export function filterByWalkAndDirection(deals: Deal[], f: PointFilter): Deal[] {
  return deals.filter((d) => {
    // 町丁目centroidが引けず距離不明な物件は駅検索の対象から外す（概算でも位置づけられないため）
    if (d.walkMinutes === undefined) return false;
    if (d.walkMinutes > f.walkMaxMinutes) return false;
    if (f.directions.length > 0 && (!d.direction || !f.directions.includes(d.direction))) return false;
    return true;
  });
}
