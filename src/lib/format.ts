// 金額表示（design.md: 万円・四捨五入位置を統一）
export function manYen(yen: number): string {
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}

export function unitManYen(yenPerSqm: number): string {
  return `${(yenPerSqm / 10000).toFixed(1)}万円/㎡`;
}

export function builtYearLabel(builtYear: number | null): string {
  if (builtYear === null) return "—";
  const age = new Date().getFullYear() - builtYear;
  return `${builtYear}年（築${age}年）`;
}
