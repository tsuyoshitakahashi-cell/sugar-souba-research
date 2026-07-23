"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { Deal } from "@/lib/aggregate/normalize";
import { median } from "@/lib/aggregate/summarize";

const AGE_BUCKETS = [
  { label: "〜築10年", min: 0, max: 10 },
  { label: "築11〜20年", min: 11, max: 20 },
  { label: "築21〜30年", min: 21, max: 30 },
  { label: "築31〜40年", min: 31, max: 40 },
  { label: "築41年〜", min: 41, max: 999 },
];

const WALK_BUCKETS = [
  { label: "〜5分", min: 0, max: 5 },
  { label: "〜10分", min: 6, max: 10 },
  { label: "〜15分", min: 11, max: 15 },
  { label: "〜20分", min: 16, max: 20 },
  { label: "20分超", min: 21, max: 9999 },
];

// 間取りの並び順（フォームのチップと揃える。未知の間取りは末尾）
const FLOOR_PLAN_ORDER = ["1R", "1K", "1DK", "1LDK", "2K", "2DK", "2LDK", "3K", "3DK", "3LDK", "4DK", "4LDK", "5LDK"];
function floorPlanRank(fp: string): number {
  const i = FLOOR_PLAN_ORDER.indexOf(fp);
  return i === -1 ? FLOOR_PLAN_ORDER.length : i;
}

export function PriceCharts({ deals, isStationSearch }: { deals: Deal[]; isStationSearch: boolean }) {
  const scatterData = deals.map((d) => ({
    area: d.area,
    price: Math.round(d.tradePrice / 10000),
    district: `${d.municipality}${d.district}`,
  }));

  const currentYear = new Date().getFullYear();
  const ageData = AGE_BUCKETS.map((b) => {
    const group = deals.filter((d) => {
      if (d.builtYear === null) return false;
      const age = currentYear - d.builtYear;
      return age >= b.min && age <= b.max;
    });
    return {
      bucket: b.label,
      count: group.length,
      unitPrice: group.length > 0 ? Number((median(group.map((d) => d.unitPrice)) / 10000).toFixed(1)) : 0,
    };
  }).filter((b) => b.count > 0);

  // 間取り別の価格中央値（万円）。間取りが取れない物件（土地等）は除外。
  // 亜種が多いと軸が潰れるため、件数上位12間取りに絞ってから表示順に並べる
  const floorPlanData = Object.entries(
    deals.reduce<Record<string, Deal[]>>((acc, d) => {
      const fp = d.floorPlan?.trim();
      if (!fp) return acc;
      (acc[fp] ??= []).push(d);
      return acc;
    }, {}),
  )
    .map(([fp, group]) => ({
      plan: fp,
      count: group.length,
      price: Number((median(group.map((d) => d.tradePrice)) / 10000).toFixed(0)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .sort((a, b) => floorPlanRank(a.plan) - floorPlanRank(b.plan));

  // 駅徒歩帯別の㎡単価中央値（万円/㎡）。徒歩の基準は検索駅（駅検索）/最寄駅（市区町村検索）で切替
  const walkOf = (d: Deal): number | undefined => (isStationSearch ? d.walkMinutes : d.nearestStationWalk);
  const walkData = WALK_BUCKETS.map((b) => {
    const group = deals.filter((d) => {
      const w = walkOf(d);
      return w !== undefined && w >= b.min && w <= b.max;
    });
    return {
      bucket: b.label,
      count: group.length,
      unitPrice: group.length > 0 ? Number((median(group.map((d) => d.unitPrice)) / 10000).toFixed(1)) : 0,
    };
  }).filter((b) => b.count > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">価格 × 面積の分布</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="area" name="面積" unit="㎡" type="number" fontSize={12} />
              <YAxis
                dataKey="price"
                name="価格"
                type="number"
                fontSize={12}
                tickFormatter={(v: number) => `${v.toLocaleString()}万`}
                width={64}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "価格" ? `${Number(value).toLocaleString()}万円` : `${value}㎡`
                }
                labelFormatter={() => ""}
              />
              <Scatter data={scatterData} fill="#1e756f" fillOpacity={0.55} />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {ageData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">築年帯別の㎡単価中央値（万円/㎡）</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="bucket" fontSize={11} />
                <YAxis fontSize={12} width={40} />
                <Tooltip
                  formatter={(value) => `${value}万円/㎡`}
                  labelFormatter={(label) => {
                    const b = ageData.find((d) => d.bucket === label);
                    return `${label}（${b?.count}件）`;
                  }}
                />
                <Bar dataKey="unitPrice" name="㎡単価" fill="#45bcb4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {floorPlanData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">間取り別の価格中央値（万円）</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={floorPlanData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="plan" fontSize={11} interval={0} />
                <YAxis
                  fontSize={12}
                  width={64}
                  tickFormatter={(v: number) => `${v.toLocaleString()}万`}
                />
                <Tooltip
                  formatter={(value) => `${Number(value).toLocaleString()}万円`}
                  labelFormatter={(label) => {
                    const b = floorPlanData.find((d) => d.plan === label);
                    return `${label}（${b?.count}件）`;
                  }}
                />
                <Bar dataKey="price" name="価格中央値" fill="#45bcb4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {walkData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {isStationSearch ? "検索駅" : "最寄駅"}徒歩帯別の㎡単価中央値（万円/㎡・概算）
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={walkData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="bucket" fontSize={11} interval={0} />
                <YAxis fontSize={12} width={40} />
                <Tooltip
                  formatter={(value) => `${value}万円/㎡`}
                  labelFormatter={(label) => {
                    const b = walkData.find((d) => d.bucket === label);
                    return `${label}（${b?.count}件）`;
                  }}
                />
                <Bar dataKey="unitPrice" name="㎡単価" fill="#1e756f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
