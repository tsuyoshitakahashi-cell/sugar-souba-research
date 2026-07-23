import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { manYen, unitManYen } from "@/lib/format";
import type { Summary } from "@/lib/aggregate/summarize";

export function SummaryCards({ summary }: { summary: Summary }) {
  const items = [
    { title: "対象件数", value: `${summary.count}件`, sub: `${summary.periodFrom}〜${summary.periodTo}` },
    { title: "価格帯", value: `${manYen(summary.priceMin)}〜${manYen(summary.priceMax)}`, sub: "最小〜最大" },
    { title: "価格中央値", value: manYen(summary.priceMedian), sub: "" },
    { title: "㎡単価の目安", value: unitManYen(summary.unitPriceMedian), sub: "各事例の㎡単価の中央値" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{it.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold leading-tight">{it.value}</p>
            {it.sub && <p className="mt-1 text-xs text-muted-foreground">{it.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
