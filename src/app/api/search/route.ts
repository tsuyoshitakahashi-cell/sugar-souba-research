import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recentQuarters, ReinfolibError } from "@/lib/reinfolib/client";
import { fetchPoints, type LandTypeCode, type PointFeature } from "@/lib/reinfolib/points-client";
import { PROPERTY_TYPE_LABEL } from "@/lib/reinfolib/types";
import type { PriceClassification } from "@/lib/reinfolib/types";
import {
  tilesCoveringRadius,
  tilesCoveringBounds,
  WALK_METERS_PER_MINUTE,
  DIRECTIONS_8,
} from "@/lib/reinfolib/tiles";
import { filterDeals, type Deal } from "@/lib/aggregate/normalize";
import { filterByWalkAndDirection, normalizePoint } from "@/lib/aggregate/normalize-point";
import { representativeDeals, summarize } from "@/lib/aggregate/summarize";
import { buildTrendComments } from "@/lib/aggregate/trend";
import { findStation } from "@/lib/stations/lookup";
import { cityBounds, findDistrictCentroid } from "@/lib/districts/lookup";

export const maxDuration = 120;

const LAND_TYPE_CODE: Record<"mansion" | "house" | "land", LandTypeCode> = {
  mansion: "07",
  house: "02",
  land: "01",
};

// 地区（町丁目）単位で取得するときのタイル半径。市よりずっと狭いが、
// 町丁目の実面積は場所によりばらつくため余裕を持たせる。
const DISTRICT_FETCH_RADIUS_METERS = 2000;

const searchSchema = z
  .object({
    areaMode: z.enum(["station", "city"]),
    stationCode: z.string().regex(/^\d{6}$/).optional(),
    prefCode: z.string().regex(/^\d{1,2}$/).optional(),
    cityCode: z.string().regex(/^\d{5}$/).optional(),
    districtName: z.string().optional(), // 市区町村検索時のみ・任意
    propertyType: z.enum(["mansion", "house", "land"]),
    builtYearMin: z.number().int().min(1900).max(2100).optional(),
    builtYearMax: z.number().int().min(1900).max(2100).optional(),
    areaMin: z.number().positive().optional(),
    areaMax: z.number().positive().optional(),
    floorPlans: z.array(z.string()).default([]),
    // 徒歩フィルタは両モード共通。未指定(null)なら絞らない
    walkMaxMinutes: z
      .union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)])
      .nullable()
      .default(20),
    directions: z.array(z.enum(DIRECTIONS_8)).default([]), // 駅検索モードのみ意味を持つ
    periodYears: z.union([z.literal(3), z.literal(5)]).default(3),
    includeUnsettled: z.boolean().default(false),
  })
  .refine((v) => (v.areaMode === "station" ? !!v.stationCode : !!v.cityCode), {
    message: "駅コードまたは市区町村コードが必要です",
  });

export type SearchRequest = z.infer<typeof searchSchema>;

// XPT001 の district_name_ja は「大船一丁目」のように丁目付きで返ることがあるため、
// 選択された大字名との比較は丁目を落として行う（findDistrictCentroidと同じ正規化）。
const CHOME_SUFFIX = /[一二三四五六七八九十０-９0-9]+丁目$/;
function districtMatches(raw: string, target: string): boolean {
  return raw === target || raw.replace(CHOME_SUFFIX, "") === target;
}

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
    const landTypeCodes: LandTypeCode[] = [LAND_TYPE_CODE[input.propertyType]];

    let features: PointFeature[];
    let searchStation: { lng: number; lat: number } | undefined;

    if (input.areaMode === "station") {
      const station = findStation(input.stationCode!);
      if (!station) {
        return NextResponse.json({ error: "駅が見つかりません。市区町村検索をお試しください" }, { status: 400 });
      }
      searchStation = { lng: station.lng, lat: station.lat };
      const radius = (input.walkMaxMinutes ?? 30) * WALK_METERS_PER_MINUTE;
      const tiles = tilesCoveringRadius(station.lng, station.lat, radius);
      features = await fetchPoints(tiles, quarters[0], quarters[quarters.length - 1], landTypeCodes, priceClassifications);
    } else {
      // 市区町村検索: 地区が選ばれていればその地区centroid周辺、なければ市全体のbboxを取得
      let tiles;
      if (input.districtName) {
        const centroid = findDistrictCentroid(input.cityCode!, input.districtName);
        if (!centroid) {
          return NextResponse.json({ error: "地区が見つかりません" }, { status: 400 });
        }
        const [lat, lng] = centroid;
        tiles = tilesCoveringRadius(lng, lat, DISTRICT_FETCH_RADIUS_METERS);
      } else {
        const bounds = cityBounds(input.cityCode!);
        if (!bounds) {
          return NextResponse.json({ error: "市区町村が見つかりません" }, { status: 400 });
        }
        tiles = tilesCoveringBounds(bounds);
      }
      const rawFeatures = await fetchPoints(
        tiles,
        quarters[0],
        quarters[quarters.length - 1],
        landTypeCodes,
        priceClassifications,
      );
      // タイルは矩形なので隣接市区町村の物件も混ざる。city_code（＋地区名）で厳密に絞る
      features = rawFeatures.filter((f) => {
        if (f.properties.city_code !== input.cityCode) return false;
        if (input.districtName && !districtMatches(f.properties.district_name_ja, input.districtName)) return false;
        return true;
      });
    }

    const normalized = features.map((f) => normalizePoint(f, searchStation)).filter((d): d is Deal => d !== null);

    const byWalk = filterByWalkAndDirection(normalized, {
      walkMaxMinutes: input.walkMaxMinutes ?? undefined,
      directions: input.areaMode === "station" ? input.directions : [],
      useSearchStationDistance: input.areaMode === "station",
    });

    const deals = filterDeals(byWalk, {
      type: PROPERTY_TYPE_LABEL[input.propertyType],
      builtYearMin: isLand ? undefined : input.builtYearMin,
      builtYearMax: isLand ? undefined : input.builtYearMax,
      areaMin: input.areaMin,
      areaMax: input.areaMax,
      floorPlans: input.floorPlans,
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
