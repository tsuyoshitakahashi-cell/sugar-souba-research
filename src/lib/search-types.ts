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
  districtNames: string[]; // 市区町村検索時のみ・複数選択可（空=市全体）
  propertyType: PropertyType;
  builtYearMin?: number;
  builtYearMax?: number;
  areaMin?: number;
  areaMax?: number;
  floorPlans: string[]; // 例 ["3LDK"]。空=絞らない
  walkMaxMinutes: 5 | 10 | 15 | 20 | 30 | null; // null=徒歩で絞らない。両モード共通
  directions: string[]; // 空=全方位（駅検索時のみ有効）
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
    isStationSearch: boolean;
  };
}
