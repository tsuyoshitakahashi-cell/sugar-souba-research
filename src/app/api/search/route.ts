import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchDeals, recentQuarters, ReinfolibError } from "@/lib/reinfolib/client";
import { fetchPoints, type LandTypeCode } from "@/lib/reinfolib/points-client";
import { PROPERTY_TYPE_LABEL } from "@/lib/reinfolib/types";
import type { PriceClassification } from "@/lib/reinfolib/types";
import { tilesCoveringRadius, WALK_METERS_PER_MINUTE, DIRECTIONS_8 } from "@/lib/reinfolib/tiles";
import { filterDeals, normalizeDeal, type Deal } from "@/lib/aggregate/normalize";
import { filterByWalkAndDirection, normalizePoint } from "@/lib/aggregate/normalize-point";
import { representativeDeals, summarize } from "@/lib/aggregate/summarize";
import { buildTrendComments } from "@/lib/aggregate/trend";
import { findStation } from "@/lib/stations/lookup";

export const maxDuration = 120;

const LAND_TYPE_CODE: Record<"mansion" | "house" | "land", LandTypeCode> = {
  mansion: "07",
  house: "02",
  land: "01",
};

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
    walkMaxMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]).default(20),
    directions: z.array(z.enum(DIRECTIONS_8)).default([]),
    periodYears: z.union([z.literal(3), z.literal(5)]).default(3),
    includeUnsettled: z.boolean().default(false),
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

  try {
    const quarters = recentQuarters(input.periodYears);
    let deals: Deal[];

    if (input.areaMode === "station") {
      // 駅検索: XPT001（座標付きポイント）→ 距離・方位で絞り込み
      const station = findStation(input.stationCode!);
      if (!station) {
        return NextResponse.json({ error: "駅が見つかりません。市区町村検索をお試しください" }, { status: 400 });
      }
      const radius = input.walkMaxMinutes * WALK_METERS_PER_MINUTE;
      const tiles = tilesCoveringRadius(station.lng, station.lat, radius);
      const features = await fetchPoints(
        tiles,
        quarters[0],
        quarters[quarters.length - 1],
        [LAND_TYPE_CODE[input.propertyType]],
        priceClassifications,
      );
      const normalized = features
        .map((f) => normalizePoint(f, station.lng, station.lat))
        .filter((d): d is Deal => d !== null);
      const byWalk = filterByWalkAndDirection(normalized, {
        walkMaxMinutes: input.walkMaxMinutes,
        directions: input.directions,
      });
      deals = filterDeals(byWalk, {
        type: PROPERTY_TYPE_LABEL[input.propertyType],
        builtYearMin: isLand ? undefined : input.builtYearMin,
        builtYearMax: isLand ? undefined : input.builtYearMax,
        areaMin: input.areaMin,
        areaMax: input.areaMax,
      });
    } else {
      // 市区町村検索: 現行 XIT001 経路
      const raw = await fetchDeals(
        quarters,
        { city: input.cityCode, area: input.prefCode },
        priceClassifications,
      );
      const normalized = raw.map(normalizeDeal).filter((d): d is Deal => d !== null);
      deals = filterDeals(normalized, {
        type: PROPERTY_TYPE_LABEL[input.propertyType],
        builtYearMin: isLand ? undefined : input.builtYearMin,
        builtYearMax: isLand ? undefined : input.builtYearMax,
        areaMin: input.areaMin,
        areaMax: input.areaMax,
      });
    }

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
        isStationSearch: input.areaMode === "station",
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
