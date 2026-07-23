import districts from "../../../data/districts.json";

// key = "<市区町村コード>|<大字名>" → [lat, lng]（町丁目centroidの代表点）
const table = districts as unknown as Record<string, [number, number]>;

const CHOME_SUFFIX = /[一二三四五六七八九十０-９0-9]+丁目$/;

// XPT001 の city_code + district_name_ja から町丁目中心座標を引く
export function findDistrictCentroid(cityCode: string, districtName: string): [number, number] | null {
  if (!districtName) return null;
  const exact = table[`${cityCode}|${districtName}`];
  if (exact) return exact;
  // reinfolib が「大船一丁目」等を返した場合は大字名に落として再検索
  const bare = districtName.replace(CHOME_SUFFIX, "");
  return table[`${cityCode}|${bare}`] ?? null;
}

// 指定市区町村コードの地区（大字・町丁目）名一覧を返す（五十音的な並びは考慮せず登録順）
export function listDistricts(cityCode: string): string[] {
  const prefix = `${cityCode}|`;
  return Object.keys(table)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 指定市区町村コードの全地区centroidを覆うbboxを返す（市全体タイル取得に使用）
export function cityBounds(cityCode: string): Bounds | null {
  const prefix = `${cityCode}|`;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let found = false;
  for (const [k, [lat, lng]] of Object.entries(table)) {
    if (!k.startsWith(prefix)) continue;
    found = true;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return found ? { minLat, maxLat, minLng, maxLng } : null;
}
