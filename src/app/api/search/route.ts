import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchDeals, recentQuarters, ReinfolibError } from "@/lib/reinfolib/client";
import { PROPERTY_TYPE_LABEL } from "@/lib/reinfolib/types";
import type { PriceClassification } from "@/lib/reinfolib/types";
import { filterDeals, normalizeDeal } from "@/lib/aggregate/normalize";
import { representativeDeals, summarize } from "@/lib/aggregate/summarize";
import { buildTrendComments } from "@/lib/aggregate/trend";

export const maxDuration = 120; // 12四半期×スリープを見込む

const searchSchema = z
  .object({
    areaMode: z.enum(["station", "city"]),
    stationCode: z.string().regex(/^\d{6}$/).optional(),
    prefCode: z.string().regex(/^\d{1,2}$/).optional(),
    cityCode: z.string().regex(/^\d{5}$/).optional(),
    propertyType: z.enum(["mansion", "house", "land"]),
    builtYearMin: z.number().int().min(1900).max(2100).optional(),
    builtYearMax: z.number().int().min(1900).max(2100).optional(),
    areaMin: z.number().positive().optional(),
    areaMax: z.number().positive().optional(),
    periodYears: z.union([z.literal(3), z.literal(5)]).default(3),
    includeUnsettled: z.boolean().default(false), // 取引価格(01)も含める
  })
  .refine((v) => (v.areaMode === "station" ? !!v.stationCode : !!v.cityCode), {
    message: "駅コードまたは市区町村コードが必要です",
  });

export type SearchRequest = z.infer<typeof searchSchema>;

export async function POST(req: NextRequest) {
  const parsed = searchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "検索条件が不正です", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // 土地は成約価格(02)が提供されていないため取引価格(01)のみ（design.md 設計判断）
  const isLand = input.propertyType === "land";
  const priceClassifications: PriceClassification[] = isLand
    ? ["01"]
    : input.includeUnsettled
      ? ["02", "01"]
      : ["02"];

  const areaQuery =
    input.areaMode === "station" ? { station: input.stationCode } : { city: input.cityCode, area: input.prefCode };

  try {
    const raw = await fetchDeals(recentQuarters(input.periodYears), areaQuery, priceClassifications);
    const normalized = raw.map(normalizeDeal).filter((d) => d !== null);
    const deals = filterDeals(normalized, {
      type: PROPERTY_TYPE_LABEL[input.propertyType],
      builtYearMin: isLand ? undefined : input.builtYearMin,
      builtYearMax: isLand ? undefined : input.builtYearMax,
      areaMin: input.areaMin,
      areaMax: input.areaMax,
    });

    const summary = summarize(deals);
    return NextResponse.json({
      summary,
      deals,
      representatives: representativeDeals(deals),
      trendComments: buildTrendComments(deals),
      meta: {
        periodYears: input.periodYears,
        priceClassifications,
        isReference: deals.length > 0 && deals.length < 10,
        landUsesUnsettledPrice: isLand,
      },
    });
  } catch (e) {
    if (e instanceof ReinfolibError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error("search failed", e);
    return NextResponse.json({ error: "検索に失敗しました。再試行してください" }, { status: 500 });
  }
}
