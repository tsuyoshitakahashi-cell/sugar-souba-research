import type { Deal } from "@/lib/aggregate/normalize";
import type { Summary } from "@/lib/aggregate/summarize";
import type { PropertyType } from "@/lib/reinfolib/types";

export interface SearchConditions {
  areaMode: "station" | "city";
  stationCode?: string;
  stationLabel?: string; // 表示用（駅名）
  prefCode?: string;
  cityCode?: string;
  cityLabel?: string;
  propertyType: PropertyType;
  builtYearMin?: number;
  builtYearMax?: number;
  areaMin?: number;
  areaMax?: number;
  periodYears: 3 | 5;
  includeUnsettled: boolean;
}

export interface SearchResult {
  summary: Summary | null;
  deals: Deal[];
  representatives: Deal[];
  trendComments: string[];
  meta: {
    periodYears: number;
    priceClassifications: string[];
    isReference: boolean;
    landUsesUnsettledPrice: boolean;
  };
}
