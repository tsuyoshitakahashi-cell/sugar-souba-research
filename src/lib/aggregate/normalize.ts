import type { RawDeal } from "@/lib/reinfolib/types";

export interface Deal {
  priceCategory: "成約" | "取引";
  type: string;
  prefecture: string;
  municipality: string;
  district: string;
  tradePrice: number; // 円
  area: number; // ㎡
  unitPrice: number; // 円/㎡
  builtYear: number | null;
  floorPlan: string;
  structure: string;
  period: string;
  // 駅検索時のみ設定: 検索駅からの距離・方位
  walkMinutes?: number; // 検索駅からの概算徒歩分（地区代表点の直線距離ベース）
  direction?: string; // 検索駅から見た8方位
  // 全モード共通: 物件の最寄駅（XPT001のgeometryをstations.jsonで逆引き）
  nearestStation?: string;
  nearestStationWalk?: number; // 最寄駅からの概算徒歩分（地区代表点基準）
}

export function zenkakuToHankaku(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/＋/g, "+");
}

export function parseBuildingYear(s: string): number | null {
  const m = s.match(/^(\d{4})年$/);
  return m ? Number(m[1]) : null;
}

export function normalizeDeal(raw: RawDeal): Deal | null {
  const tradePrice = Number(raw.TradePrice);
  const area = Number(raw.Area);
  if (!Number.isFinite(tradePrice) || tradePrice <= 0) return null;
  if (!Number.isFinite(area) || area <= 0) return null;
  return {
    priceCategory: raw.PriceCategory === "成約価格情報" ? "成約" : "取引",
    type: raw.Type,
    prefecture: raw.Prefecture,
    municipality: raw.Municipality,
    district: raw.DistrictName,
    tradePrice,
    area,
    unitPrice: tradePrice / area,
    builtYear: parseBuildingYear(raw.BuildingYear),
    floorPlan: zenkakuToHankaku(raw.FloorPlan),
    structure: zenkakuToHankaku(raw.Structure),
    period: raw.Period,
  };
}

export interface DealFilter {
  type: string;
  builtYearMin?: number;
  builtYearMax?: number;
  areaMin?: number;
  areaMax?: number;
  floorPlans?: string[]; // 半角正規化済みの間取り文字列（例 "3LDK"）。空/未指定なら絞らない
}

export function filterDeals(deals: Deal[], f: DealFilter): Deal[] {
  return deals.filter((d) => {
    if (d.type !== f.type) return false;
    if (f.areaMin !== undefined && d.area < f.areaMin) return false;
    if (f.areaMax !== undefined && d.area > f.areaMax) return false;
    if (f.builtYearMin !== undefined || f.builtYearMax !== undefined) {
      if (d.builtYear === null) return false; // 築年条件がある場合、築年不明は除外
      if (f.builtYearMin !== undefined && d.builtYear < f.builtYearMin) return false;
      if (f.builtYearMax !== undefined && d.builtYear > f.builtYearMax) return false;
    }
    // 「3LDK+S」等の亜種も拾えるよう前方一致で判定する
    if (f.floorPlans && f.floorPlans.length > 0 && !f.floorPlans.some((fp) => d.floorPlan.startsWith(fp))) {
      return false;
    }
    return true;
  });
}
