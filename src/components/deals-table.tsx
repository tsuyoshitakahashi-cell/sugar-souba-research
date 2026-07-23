"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { builtYearLabel, manYen, unitManYen } from "@/lib/format";
import type { Deal } from "@/lib/aggregate/normalize";

type SortKey = "tradePrice" | "area" | "unitPrice" | "builtYear" | "period";

function dealKey(d: Deal): string {
  return [d.municipality, d.district, d.tradePrice, d.area, d.period, d.priceCategory].join("|");
}

export function DealsTable({
  deals,
  representatives,
  mixedCategories,
}: {
  deals: Deal[];
  representatives: Deal[];
  mixedCategories: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("tradePrice");
  const [desc, setDesc] = useState(true);
  const repKeys = useMemo(() => new Set(representatives.map(dealKey)), [representatives]);

  const sorted = useMemo(() => {
    const arr = [...deals].sort((a, b) => {
      const va = a[sortKey] ?? -Infinity;
      const vb = b[sortKey] ?? -Infinity;
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return desc ? arr.reverse() : arr;
  }, [deals, sortKey, desc]);

  function header(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <TableHead>
        <button
          type="button"
          className={`inline-flex items-center gap-1 ${active ? "font-bold" : ""}`}
          onClick={() => {
            if (active) setDesc(!desc);
            else {
              setSortKey(key);
              setDesc(true);
            }
          }}
        >
          {label}
          {active && <span className="text-xs">{desc ? "▼" : "▲"}</span>}
        </button>
      </TableHead>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          事例一覧（{deals.length}件）
          <span className="ml-2 font-normal text-muted-foreground">★=中央値に近い代表事例</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>所在地</TableHead>
              {header("価格", "tradePrice")}
              {header("面積", "area")}
              {header("㎡単価", "unitPrice")}
              {header("築年", "builtYear")}
              <TableHead>間取り</TableHead>
              {header("時期", "period")}
              {mixedCategories && <TableHead>区分</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((d, i) => {
              const isRep = repKeys.has(dealKey(d));
              return (
                <TableRow key={`${dealKey(d)}-${i}`} className={isRep ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                  <TableCell className="whitespace-nowrap">
                    {isRep && <span className="mr-1 text-amber-500">★</span>}
                    {d.municipality}
                    {d.district}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{manYen(d.tradePrice)}</TableCell>
                  <TableCell>{d.area}㎡</TableCell>
                  <TableCell className="whitespace-nowrap">{unitManYen(d.unitPrice)}</TableCell>
                  <TableCell className="whitespace-nowrap">{builtYearLabel(d.builtYear)}</TableCell>
                  <TableCell>{d.floorPlan || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{d.period}</TableCell>
                  {mixedCategories && (
                    <TableCell>
                      <Badge variant={d.priceCategory === "成約" ? "default" : "secondary"}>
                        {d.priceCategory}
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
