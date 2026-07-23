import { ReinfolibError } from "./client";
import type { PriceClassification, Quarter } from "./types";
import type { Tile } from "./tiles";

const BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external";
const REQUEST_INTERVAL_MS = 600; // レート配慮（プロジェクト憲法）
const QUARTER_SECONDS = 90 * 24 * 60 * 60;
const DAY_SECONDS = 24 * 60 * 60;

// XPT001 の properties（GeoJSON、全フィールド整形済み文字列）
export interface PointProps {
  point_in_time_name_ja: string; // 「2024年第2四半期」
  land_type_name_ja: string;
  price_information_category_name_ja: string; // 成約価格情報 | 不動産取引価格情報
  prefecture_name_ja: string;
  city_code: string;
  city_name_ja: string;
  district_name_ja: string;
  u_transaction_price_total_ja: string; // 「1,900万円」
  u_area_ja: string; // 「70㎡」（マンション=専有面積 / 戸建・土地=土地面積）
  u_building_total_floor_area_ja?: string; // 「90㎡」（戸建の建物延床面積）
  u_construction_year_ja: string; // 「1988年」
  building_structure_name_ja: string;
  floor_plan_name_ja: string;
}

export interface PointFeature {
  geometry: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
  properties: PointProps;
}

// XPT001 の landTypeCode（種別）
export type LandTypeCode = "01" | "02" | "07"; // 01=土地, 02=土地と建物, 07=中古マンション等

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toYYYYN(q: Quarter): string {
  return `${q.year}${q.quarter}`;
}

function isSettledQuarter(q: Quarter, now: Date = new Date()): boolean {
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const diff = (now.getFullYear() - q.year) * 4 + (currentQuarter - q.quarter);
  return diff >= 3;
}

export async function fetchTilePoints(
  tile: Tile,
  from: Quarter,
  to: Quarter,
  landTypeCodes: LandTypeCode[],
  priceClassification: PriceClassification,
): Promise<PointFeature[]> {
  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) throw new ReinfolibError("REINFOLIB_API_KEY が未設定です", 500);

  const params = new URLSearchParams({
    response_format: "geojson",
    z: String(tile.z),
    x: String(tile.x),
    y: String(tile.y),
    from: toYYYYN(from),
    to: toYYYYN(to),
    priceClassification,
  });
  if (landTypeCodes.length > 0) params.set("landTypeCode", landTypeCodes.join(","));

  const res = await fetch(`${BASE_URL}/XPT001?${params}`, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
    next: { revalidate: isSettledQuarter(to) ? QUARTER_SECONDS : DAY_SECONDS },
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new ReinfolibError(`不動産情報ライブラリAPIエラー (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { features?: PointFeature[] };
  return body.features ?? [];
}

export async function fetchPoints(
  tiles: Tile[],
  from: Quarter,
  to: Quarter,
  landTypeCodes: LandTypeCode[],
  priceClassifications: PriceClassification[],
): Promise<PointFeature[]> {
  const jobs = priceClassifications.flatMap((pc) => tiles.map((t) => ({ t, pc })));
  const all: PointFeature[] = [];
  for (let i = 0; i < jobs.length; i++) {
    if (i > 0) await sleep(REQUEST_INTERVAL_MS);
    const { t, pc } = jobs[i];
    all.push(...(await fetchTilePoints(t, from, to, landTypeCodes, pc)));
  }
  return all;
}
