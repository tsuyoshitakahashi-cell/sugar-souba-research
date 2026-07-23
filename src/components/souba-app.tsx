"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DealsTable } from "@/components/deals-table";
import { PriceCharts } from "@/components/price-charts";
import { SearchForm } from "@/components/search-form";
import { SummaryCards } from "@/components/summary-cards";
import type { SearchConditions, SearchResult } from "@/lib/search-types";

const PROPERTY_LABEL = { mansion: "中古マンション", house: "中古戸建", land: "土地" } as const;

export function SoubaApp() {
  const [conditions, setConditions] = useState<SearchConditions | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function search(c: SearchConditions) {
    setSearching(true);
    setError("");
    setConditions(c);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "検索に失敗しました。再試行してください");
        setResult(null);
        return;
      }
      setResult(await res.json());
    } catch {
      setError("通信に失敗しました。再試行してください");
      setResult(null);
    } finally {
      setSearching(false);
    }
  }

  const areaLabel = conditions
    ? conditions.areaMode === "station"
      ? `${conditions.stationLabel}駅 周辺`
      : conditions.cityLabel
    : "";

  return (
    <div className="space-y-6">
      <SearchForm onSearch={search} searching={searching} />

      {searching && <LoadingSkeleton />}

      {error && !searching && (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-between pt-6">
            <p className="text-sm text-destructive">{error}</p>
            {conditions && (
              <Button variant="outline" onClick={() => search(conditions)}>
                再試行
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {result && conditions && !searching && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">
              {areaLabel} の{PROPERTY_LABEL[conditions.propertyType]}相場
            </h2>
            <Badge variant="outline">直近{result.meta.periodYears}年</Badge>
            {result.meta.isReference && <Badge variant="destructive">参考値（10件未満）</Badge>}
            {result.meta.landUsesUnsettledPrice && (
              <Badge variant="secondary">取引価格ベース</Badge>
            )}
          </div>

          {result.summary === null ? (
            <NoResult conditions={conditions} onExpand={search} />
          ) : (
            <>
              <SummaryCards summary={result.summary} />

              {result.trendComments.length > 0 && (
                <Card>
                  <CardContent className="space-y-1 pt-6">
                    {result.trendComments.map((c) => (
                      <p key={c} className="text-sm">
                        ・{c}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.meta.isReference && (
                <ExpandButtons conditions={conditions} meta={result.meta} onExpand={search} />
              )}

              <PriceCharts deals={result.deals} />
              <DealsTable
                deals={result.deals}
                representatives={result.representatives}
                mixedCategories={result.meta.priceClassifications.length > 1}
                showWalk={result.meta.isStationSearch}
              />
            </>
          )}

          <PriceNotice
            isLand={result.meta.landUsesUnsettledPrice}
            isStation={result.meta.isStationSearch}
          />
        </>
      )}
    </div>
  );
}

function ExpandButtons({
  conditions,
  meta,
  onExpand,
}: {
  conditions: SearchConditions;
  meta: SearchResult["meta"];
  onExpand: (c: SearchConditions) => void;
}) {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <p className="text-sm">該当が少ないため参考値です。条件を広げられます:</p>
        {conditions.periodYears === 3 && (
          <Button variant="outline" size="sm" onClick={() => onExpand({ ...conditions, periodYears: 5 })}>
            期間を5年に広げる
          </Button>
        )}
        {conditions.propertyType !== "land" && !conditions.includeUnsettled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExpand({ ...conditions, includeUnsettled: true })}
          >
            取引価格も含める（区分表示）
          </Button>
        )}
        {meta.isReference && conditions.periodYears === 5 && conditions.includeUnsettled && (
          <p className="text-xs text-muted-foreground">これ以上の拡張条件はありません</p>
        )}
      </CardContent>
    </Card>
  );
}

function NoResult({
  conditions,
  onExpand,
}: {
  conditions: SearchConditions;
  onExpand: (c: SearchConditions) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="font-medium">該当する事例が見つかりませんでした。</p>
        <div className="flex flex-wrap gap-2">
          {conditions.periodYears === 3 && (
            <Button variant="outline" size="sm" onClick={() => onExpand({ ...conditions, periodYears: 5 })}>
              期間を5年に広げる
            </Button>
          )}
          {conditions.propertyType !== "land" && !conditions.includeUnsettled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExpand({ ...conditions, includeUnsettled: true })}
            >
              取引価格も含める
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          面積・築年数の条件を緩めるか、隣の駅・市区町村でもお試しください。
        </p>
      </CardContent>
    </Card>
  );
}

function PriceNotice({ isLand, isStation }: { isLand: boolean; isStation: boolean }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
      <p>
        {isLand ? (
          <>
            【注意】土地は国土交通省の<strong>不動産取引価格情報</strong>
            （アンケート等に基づく取引価格）です。成約価格データは提供されておらず、現在の売り出し価格とも異なります。
          </>
        ) : (
          <>
            【注意】表示している価格は<strong>成約価格</strong>
            （実際に売れた価格）です。現在の売り出し価格とは異なります。
          </>
        )}
      </p>
      {isStation && (
        <p>
          【徒歩・方角について】駅からの徒歩分・方角は、物件が属する<strong>町丁目の中心地点</strong>
          から駅までの直線距離による<strong>概算</strong>です。実際の徒歩ルート・物件位置とは異なります。
        </p>
      )}
      <p>出典: 国土交通省 不動産情報ライブラリ／位置参照情報</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        国土交通省の不動産情報ライブラリから四半期ごとにデータを取得しています（初回は最大30秒ほどかかります）…
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
