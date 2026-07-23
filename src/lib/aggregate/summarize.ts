import type { Deal } from "./normalize";

export interface Summary {
  count: number;
  priceMin: number;
  priceMax: number;
  priceMedian: number;
  unitPriceMedian: number; // 円/㎡（各件の単価の中央値）
  periodFrom: string;
  periodTo: string;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function summarize(deals: Deal[]): Summary | null {
  if (deals.length === 0) return null;
  const prices = deals.map((d) => d.tradePrice);
  const periods = deals.map((d) => d.period).sort();
  return {
    count: deals.length,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    priceMedian: median(prices),
    unitPriceMedian: median(deals.map((d) => d.unitPrice)),
    periodFrom: periods[0],
    periodTo: periods[periods.length - 1],
  };
}

// 中央値に近い順に代表事例を選ぶ
export function representativeDeals(deals: Deal[], n = 5): Deal[] {
  const m = median(deals.map((d) => d.tradePrice));
  return [...deals].sort((a, b) => Math.abs(a.tradePrice - m) - Math.abs(b.tradePrice - m)).slice(0, n);
}
