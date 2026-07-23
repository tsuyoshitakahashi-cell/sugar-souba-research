// 神奈川県の市区町村を、政令市（横浜・川崎・相模原）は区単位、その他は市町村単位でグループ化する。
// XIT002 は区名を「鶴見区」のように親市名なしで返すため、親市名を補って一意に表示する。
// 政令市の市全体コード（14100/14130/14150）は「区は別々に」の方針により候補から除外する。

export interface CityOption {
  id: string;
  name: string; // 表示・cityLabel 用のフルネーム（例: 横浜市鶴見区）
}

export interface CityGroup {
  label: string;
  cities: CityOption[];
}

const WHOLE_CITY_CODES = new Set(["14100", "14130", "14150"]);

// 区コード → 親市名
function wardParent(code: number): string | null {
  if (code >= 14101 && code <= 14118) return "横浜市";
  if (code >= 14131 && code <= 14137) return "川崎市";
  if (code >= 14151 && code <= 14153) return "相模原市";
  return null;
}

export function groupKanagawaCities(raw: { id: string; name: string }[]): CityGroup[] {
  const yokohama: CityOption[] = [];
  const kawasaki: CityOption[] = [];
  const sagamihara: CityOption[] = [];
  const others: CityOption[] = [];

  for (const c of raw) {
    if (WHOLE_CITY_CODES.has(c.id)) continue; // 市全体は除外（区単位で選ぶ）
    const parent = wardParent(Number(c.id));
    if (parent === "横浜市") yokohama.push({ id: c.id, name: `横浜市${c.name}` });
    else if (parent === "川崎市") kawasaki.push({ id: c.id, name: `川崎市${c.name}` });
    else if (parent === "相模原市") sagamihara.push({ id: c.id, name: `相模原市${c.name}` });
    else others.push({ id: c.id, name: c.name });
  }

  return [
    { label: "横浜市（区）", cities: yokohama },
    { label: "川崎市（区）", cities: kawasaki },
    { label: "相模原市（区）", cities: sagamihara },
    { label: "その他の市町村", cities: others },
  ].filter((g) => g.cities.length > 0);
}
