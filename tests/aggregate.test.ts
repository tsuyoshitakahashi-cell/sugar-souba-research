import { describe, expect, it } from "vitest";
import {
  filterDeals,
  normalizeDeal,
  parseBuildingYear,
  zenkakuToHankaku,
  type Deal,
} from "@/lib/aggregate/normalize";
import { median, representativeDeals, summarize } from "@/lib/aggregate/summarize";
import { buildTrendComments } from "@/lib/aggregate/trend";
import { recentQuarters } from "@/lib/reinfolib/client";
import type { RawDeal } from "@/lib/reinfolib/types";

function rawDeal(overrides: Partial<RawDeal>): RawDeal {
  return {
    PriceCategory: "成約価格情報",
    Type: "中古マンション等",
    Region: "",
    MunicipalityCode: "14101",
    Prefecture: "神奈川県",
    Municipality: "横浜市鶴見区",
    DistrictName: "市場下町",
    TradePrice: "16000000",
    PricePerUnit: "",
    FloorPlan: "２ＤＫ",
    Area: "50",
    UnitPrice: "",
    LandShape: "",
    Frontage: "",
    TotalFloorArea: "",
    BuildingYear: "1983年",
    Structure: "ＲＣ",
    Use: "",
    Purpose: "",
    Direction: "",
    Classification: "",
    Breadth: "",
    CityPlanning: "",
    CoverageRatio: "",
    FloorAreaRatio: "",
    Period: "2025年第3四半期",
    Renovation: "",
    Remarks: "",
    DistrictCode: "",
    ...overrides,
  };
}

function deal(overrides: Partial<Deal>): Deal {
  return {
    priceCategory: "成約",
    type: "中古マンション等",
    prefecture: "神奈川県",
    municipality: "鎌倉市",
    district: "大町",
    tradePrice: 30000000,
    area: 60,
    unitPrice: 500000,
    builtYear: 2000,
    floorPlan: "3LDK",
    structure: "RC",
    period: "2025年第3四半期",
    ...overrides,
  };
}

describe("parseBuildingYear", () => {
  it("西暦「1983年」形式を数値にする", () => {
    expect(parseBuildingYear("1983年")).toBe(1983);
    expect(parseBuildingYear("2025年")).toBe(2025);
  });
  it("空文字・不正値は null", () => {
    expect(parseBuildingYear("")).toBeNull();
    expect(parseBuildingYear("昭和58年")).toBeNull();
  });
});

describe("zenkakuToHankaku", () => {
  it("全角英数を半角にする", () => {
    expect(zenkakuToHankaku("２ＬＤＫ")).toBe("2LDK");
    expect(zenkakuToHankaku("ＲＣ")).toBe("RC");
  });
});

describe("normalizeDeal", () => {
  it("円・㎡を数値化し㎡単価を計算する", () => {
    const d = normalizeDeal(rawDeal({}));
    expect(d).not.toBeNull();
    expect(d?.tradePrice).toBe(16000000);
    expect(d?.area).toBe(50);
    expect(d?.unitPrice).toBe(320000);
    expect(d?.priceCategory).toBe("成約");
    expect(d?.floorPlan).toBe("2DK");
  });
  it("価格・面積が欠損したレコードは捨てる", () => {
    expect(normalizeDeal(rawDeal({ TradePrice: "" }))).toBeNull();
    expect(normalizeDeal(rawDeal({ Area: "0" }))).toBeNull();
  });
});

describe("filterDeals", () => {
  const deals = [
    deal({ builtYear: 1990, area: 55 }),
    deal({ builtYear: 2010, area: 70 }),
    deal({ builtYear: null, area: 65 }),
    deal({ type: "宅地(土地と建物)", builtYear: 2000, area: 100 }),
  ];
  it("種別・築年・面積で絞り込む", () => {
    const r = filterDeals(deals, { type: "中古マンション等", builtYearMin: 2000, areaMin: 60 });
    expect(r).toHaveLength(1);
    expect(r[0].builtYear).toBe(2010);
  });
  it("築年条件があるとき築年不明は除外する", () => {
    const r = filterDeals(deals, { type: "中古マンション等", builtYearMax: 2020 });
    expect(r.every((d) => d.builtYear !== null)).toBe(true);
  });
  it("築年条件がなければ築年不明も含める", () => {
    const r = filterDeals(deals, { type: "中古マンション等" });
    expect(r).toHaveLength(3);
  });
});

describe("median / summarize", () => {
  it("中央値（奇数・偶数）", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it("サマリーは件数・価格帯・中央値・㎡単価中央値を返す", () => {
    const s = summarize([
      deal({ tradePrice: 20000000, area: 50 }),
      deal({ tradePrice: 30000000, area: 60 }),
      deal({ tradePrice: 40000000, area: 80 }),
    ]);
    expect(s?.count).toBe(3);
    expect(s?.priceMin).toBe(20000000);
    expect(s?.priceMax).toBe(40000000);
    expect(s?.priceMedian).toBe(30000000);
  });
  it("0件は null", () => {
    expect(summarize([])).toBeNull();
  });
});

describe("representativeDeals", () => {
  it("中央値に近い順に選ぶ", () => {
    const deals = [10, 20, 30, 40, 100].map((m) => deal({ tradePrice: m * 1000000 }));
    const reps = representativeDeals(deals, 3);
    expect(reps[0].tradePrice).toBe(30000000);
    expect(reps.map((d) => d.tradePrice)).not.toContain(100000000);
  });
});

describe("buildTrendComments", () => {
  it("群が小さいときはコメントを出さない（推測しない）", () => {
    expect(buildTrendComments([deal({}), deal({})])).toHaveLength(0);
  });
  it("築年で単価差があればコメントする", () => {
    const newer = Array.from({ length: 6 }, (_, i) =>
      deal({ builtYear: 2015, unitPrice: 600000 + i, area: 60, tradePrice: 36000000 }),
    );
    const older = Array.from({ length: 6 }, (_, i) =>
      deal({ builtYear: 1985, unitPrice: 300000 + i, area: 60, tradePrice: 18000000 }),
    );
    const comments = buildTrendComments([...newer, ...older]);
    expect(comments.some((c) => c.includes("築25年以内"))).toBe(true);
  });
  it("最大3件まで", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      deal({
        builtYear: i % 2 === 0 ? 2015 : 1985,
        unitPrice: i % 2 === 0 ? 600000 : 300000,
        area: i % 3 === 0 ? 40 : 80,
        tradePrice: i % 2 === 0 ? 36000000 : 18000000,
        period: `202${(i % 5) + 1}年第1四半期`,
      }),
    );
    expect(buildTrendComments(many).length).toBeLessThanOrEqual(3);
  });
});

describe("recentQuarters", () => {
  it("進行中の四半期を含めず直近N年ぶんを返す", () => {
    const qs = recentQuarters(3, new Date("2026-07-23")); // 2026Q3進行中
    expect(qs).toHaveLength(12);
    expect(qs[qs.length - 1]).toEqual({ year: 2026, quarter: 2 });
    expect(qs[0]).toEqual({ year: 2023, quarter: 3 });
  });
  it("年始（Q1進行中）は前年Q4まで", () => {
    const qs = recentQuarters(1, new Date("2026-02-01"));
    expect(qs[qs.length - 1]).toEqual({ year: 2025, quarter: 4 });
    expect(qs[0]).toEqual({ year: 2025, quarter: 1 });
  });
});
