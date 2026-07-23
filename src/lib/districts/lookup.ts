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
