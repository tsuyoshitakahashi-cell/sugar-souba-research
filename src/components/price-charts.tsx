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

export function PriceCharts({ deals }: { deals: Deal[] }) {
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
              <Scatter data={scatterData} fill="#2563eb" fillOpacity={0.6} />
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
                <Bar dataKey="unitPrice" name="㎡単価" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
