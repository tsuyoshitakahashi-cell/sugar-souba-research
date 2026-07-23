import type { Deal } from "./normalize";
import { median } from "./summarize";

// 傾向コメントはルールベースのみ（LLM不使用）。
// 「数字は取得データの範囲内だけで述べる」原則: 両群に最低件数があり、
// 差が閾値を超えたときだけ文章化する。

const MIN_GROUP_SIZE = 5;
const MIN_DIFF_RATIO = 0.1;

function manYen(yen: number): string {
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}

function unitManYen(yenPerSqm: number): string {
  return `${(yenPerSqm / 10000).toFixed(1)}万円/㎡`;
}

function compareGroups(
  a: Deal[],
  b: Deal[],
  build: (aMedian: number, bMedian: number, ratio: number) => string,
): string | null {
  if (a.length < MIN_GROUP_SIZE || b.length < MIN_GROUP_SIZE) return null;
  const ma = median(a.map((d) => d.unitPrice));
  const mb = median(b.map((d) => d.unitPrice));
  if (mb === 0) return null;
  const ratio = (ma - mb) / mb;
  if (Math.abs(ratio) < MIN_DIFF_RATIO) return null;
  return build(ma, mb, ratio);
}

export function buildTrendComments(deals: Deal[]): string[] {
  const comments: string[] = [];

  // 築年: 築25年で二分して㎡単価を比較（土地は builtYear が無いので自然にスキップ）
  const currentYear = new Date().getFullYear();
  const withYear = deals.filter((d) => d.builtYear !== null);
  const newer = withYear.filter((d) => currentYear - (d.builtYear as number) <= 25);
  const older = withYear.filter((d) => currentYear - (d.builtYear as number) > 25);
  const byAge = compareGroups(newer, older, (ma, mb) =>
    `築25年以内の㎡単価中央値は${unitManYen(ma)}、築26年超は${unitManYen(mb)}と差があります。`,
  );
  if (byAge) comments.push(byAge);

  // 面積: 面積中央値で二分して総額を比較
  const areaMedian = median(deals.map((d) => d.area));
  const smaller = deals.filter((d) => d.area <= areaMedian);
  const larger = deals.filter((d) => d.area > areaMedian);
  if (smaller.length >= MIN_GROUP_SIZE && larger.length >= MIN_GROUP_SIZE) {
    const ms = median(smaller.map((d) => d.tradePrice));
    const ml = median(larger.map((d) => d.tradePrice));
    comments.push(
      `${Math.round(areaMedian)}㎡以下の価格中央値は${manYen(ms)}、それより広い物件は${manYen(ml)}です。`,
    );
  }

  // 直近1年 vs それ以前の㎡単価（期間文字列の辞書順で近似）
  const periods = [...new Set(deals.map((d) => d.period))].sort();
  if (periods.length >= 5) {
    const recentPeriods = new Set(periods.slice(-4));
    const recent = deals.filter((d) => recentPeriods.has(d.period));
    const earlier = deals.filter((d) => !recentPeriods.has(d.period));
    const byTime = compareGroups(recent, earlier, (ma, mb, ratio) =>
      ratio > 0
        ? `直近1年の㎡単価中央値（${unitManYen(ma)}）はそれ以前（${unitManYen(mb)}）より高く、上昇傾向です。`
        : `直近1年の㎡単価中央値（${unitManYen(ma)}）はそれ以前（${unitManYen(mb)}）より低くなっています。`,
    );
    if (byTime) comments.push(byTime);
  }

  return comments.slice(0, 3);
}
