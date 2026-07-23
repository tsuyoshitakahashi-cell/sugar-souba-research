// XIT001 レスポンス（2026-07-23 疎通確認で確定。全フィールド文字列、該当なしは空文字）
export interface RawDeal {
  PriceCategory: string; // 成約価格情報 | 不動産取引価格情報
  Type: string; // 中古マンション等 | 宅地(土地と建物) | 宅地(土地) | 農地 | 林地
  Region: string;
  MunicipalityCode: string;
  Prefecture: string;
  Municipality: string;
  DistrictName: string;
  TradePrice: string; // 円
  PricePerUnit: string;
  FloorPlan: string; // 全角英数（例: ２ＬＤＫ）
  Area: string; // ㎡
  UnitPrice: string;
  LandShape: string;
  Frontage: string;
  TotalFloorArea: string;
  BuildingYear: string; // 西暦「1983年」形式
  Structure: string;
  Use: string;
  Purpose: string;
  Direction: string;
  Classification: string;
  Breadth: string;
  CityPlanning: string;
  CoverageRatio: string;
  FloorAreaRatio: string;
  Period: string; // 「2025年第3四半期」
  Renovation: string;
  Remarks: string;
  DistrictCode: string;
}

export type PriceClassification = "01" | "02"; // 01=取引価格, 02=成約価格

export interface Quarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

export type PropertyType = "mansion" | "house" | "land";

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  mansion: "中古マンション等",
  house: "宅地(土地と建物)",
  land: "宅地(土地)",
};
