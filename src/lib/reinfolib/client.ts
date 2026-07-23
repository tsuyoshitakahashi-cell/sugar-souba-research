import type { PriceClassification, Quarter, RawDeal } from "./types";

const BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external";
const REQUEST_INTERVAL_MS = 600; // レート配慮: 連続リクエスト禁止（プロジェクト憲法）

const QUARTER_SECONDS = 90 * 24 * 60 * 60;
const DAY_SECONDS = 24 * 60 * 60;

export interface AreaQuery {
  station?: string; // N02グループコード6桁
  city?: string; // 市区町村コード5桁
  area?: string; // 都道府県コード（cityと併用可）
}

export class ReinfolibError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 確定済み四半期（データが揃いうる過去分）かどうかでキャッシュ期間を変える
function isSettledQuarter(q: Quarter): boolean {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const diff = (now.getFullYear() - q.year) * 4 + (currentQuarter - q.quarter);
  return diff >= 3; // 公開ラグを見込み、3四半期以上前を「確定」扱い
}

export async function fetchQuarterDeals(
  quarter: Quarter,
  areaQuery: AreaQuery,
  priceClassification: PriceClassification,
): Promise<RawDeal[]> {
  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) throw new ReinfolibError("REINFOLIB_API_KEY が未設定です", 500);

  const params = new URLSearchParams({
    year: String(quarter.year),
    quarter: String(quarter.quarter),
    priceClassification,
  });
  if (areaQuery.station) params.set("station", areaQuery.station);
  if (areaQuery.city) params.set("city", areaQuery.city);
  if (areaQuery.area) params.set("area", areaQuery.area);

  const res = await fetch(`${BASE_URL}/XIT001?${params}`, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
    next: { revalidate: isSettledQuarter(quarter) ? QUARTER_SECONDS : DAY_SECONDS },
  });

  if (res.status === 404) return []; // {"message":"検索結果がありません。"}
  if (!res.ok) {
    throw new ReinfolibError(`不動産情報ライブラリAPIエラー (HTTP ${res.status})`, res.status);
  }
  const body = (await res.json()) as { data?: RawDeal[] };
  return body.data ?? [];
}

export async function fetchDeals(
  quarters: Quarter[],
  areaQuery: AreaQuery,
  priceClassifications: PriceClassification[],
  onProgress?: (done: number, total: number) => void,
): Promise<RawDeal[]> {
  const jobs = priceClassifications.flatMap((pc) => quarters.map((q) => ({ q, pc })));
  const all: RawDeal[] = [];
  for (let i = 0; i < jobs.length; i++) {
    if (i > 0) await sleep(REQUEST_INTERVAL_MS);
    const { q, pc } = jobs[i];
    all.push(...(await fetchQuarterDeals(q, areaQuery, pc)));
    onProgress?.(i + 1, jobs.length);
  }
  return all;
}

// 直近 years 年ぶんの「完了した」四半期リスト（新しい順ではなく古い順）
export function recentQuarters(years: number, now: Date = new Date()): Quarter[] {
  const currentQuarter = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const quarters: Quarter[] = [];
  let y = now.getFullYear();
  let q = currentQuarter - 1; // 進行中の四半期は含めない
  if (q === 0) {
    y -= 1;
    q = 4;
  }
  for (let i = 0; i < years * 4; i++) {
    quarters.unshift({ year: y, quarter: q as 1 | 2 | 3 | 4 });
    q -= 1;
    if (q === 0) {
      y -= 1;
      q = 4;
    }
  }
  return quarters;
}
