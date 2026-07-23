"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PREF_CODE, PREFECTURES } from "@/lib/prefectures";
import type { SearchConditions } from "@/lib/search-types";
import type { PropertyType } from "@/lib/reinfolib/types";

interface StationHit {
  code: string;
  name: string;
  lines: string[];
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "mansion", label: "中古マンション" },
  { value: "house", label: "中古戸建" },
  { value: "land", label: "土地" },
];

const AGE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 50];
const AREA_OPTIONS = [20, 30, 40, 50, 60, 70, 80, 100, 120, 150, 200];
const WALK_OPTIONS = [5, 10, 15, 20, 30] as const;
const DIRECTIONS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"] as const;
const NONE = "none";
const PRESET_KEY = "souba-preset-v1";

interface Preset {
  propertyType: PropertyType;
  ageMin: string;
  ageMax: string;
  areaMin: string;
  areaMax: string;
  walkMaxMinutes: number;
  directions: string[];
}

export function SearchForm({
  onSearch,
  searching,
}: {
  onSearch: (c: SearchConditions) => void;
  searching: boolean;
}) {
  const [areaMode, setAreaMode] = useState<"station" | "city">("station");
  const [propertyType, setPropertyType] = useState<PropertyType>("mansion");

  const [stationQuery, setStationQuery] = useState("");
  const [stationHits, setStationHits] = useState<StationHit[]>([]);
  const [station, setStation] = useState<StationHit | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prefCode, setPrefCode] = useState(DEFAULT_PREF_CODE);
  const [cityOptions, setCityOptions] = useState<{ id: string; name: string }[]>([]);
  const [cityCode, setCityCode] = useState("");

  const [ageMin, setAgeMin] = useState(NONE);
  const [ageMax, setAgeMax] = useState(NONE);
  const [areaMin, setAreaMin] = useState(NONE);
  const [areaMax, setAreaMax] = useState(NONE);
  const [walkMaxMinutes, setWalkMaxMinutes] = useState<number>(20);
  const [directions, setDirections] = useState<string[]>([]);
  const [presetSaved, setPresetSaved] = useState(false);

  // プリセット復元（初回のみ）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Preset;
      setPropertyType(p.propertyType);
      setAgeMin(p.ageMin);
      setAgeMax(p.ageMax);
      setAreaMin(p.areaMin);
      setAreaMax(p.areaMax);
      setWalkMaxMinutes(p.walkMaxMinutes);
      setDirections(p.directions);
    } catch {
      // 壊れたプリセットは無視
    }
  }, []);

  function toggleDirection(d: string) {
    setDirections((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function savePreset() {
    const p: Preset = { propertyType, ageMin, ageMax, areaMin, areaMax, walkMaxMinutes, directions };
    localStorage.setItem(PRESET_KEY, JSON.stringify(p));
    setPresetSaved(true);
    setTimeout(() => setPresetSaved(false), 2000);
  }

  // 駅名オートコンプリート（300msデバウンス）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!stationQuery || (station && stationQuery === station.name)) {
      setStationHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/stations?q=${encodeURIComponent(stationQuery)}`);
      if (res.ok) setStationHits((await res.json()).stations);
    }, 300);
  }, [stationQuery, station]);

  useEffect(() => {
    setCityCode("");
    fetch(`/api/cities?pref=${prefCode}`)
      .then((r) => r.json())
      .then((d) => setCityOptions(d.cities ?? []));
  }, [prefCode]);

  const isLand = propertyType === "land";
  const currentYear = new Date().getFullYear();
  const canSearch = areaMode === "station" ? station !== null : cityCode !== "";

  function handleSubmit() {
    if (!canSearch) return;
    onSearch({
      areaMode,
      stationCode: areaMode === "station" ? station?.code : undefined,
      stationLabel: areaMode === "station" ? station?.name : undefined,
      prefCode: areaMode === "city" ? prefCode : undefined,
      cityCode: areaMode === "city" ? cityCode : undefined,
      cityLabel: areaMode === "city" ? cityOptions.find((c) => c.id === cityCode)?.name : undefined,
      propertyType,
      // 築N年〜M年 → 建築年レンジに変換（築が浅い=建築年が新しい）
      builtYearMin: !isLand && ageMax !== NONE ? currentYear - Number(ageMax) : undefined,
      builtYearMax: !isLand && ageMin !== NONE ? currentYear - Number(ageMin) : undefined,
      areaMin: areaMin !== NONE ? Number(areaMin) : undefined,
      areaMax: areaMax !== NONE ? Number(areaMax) : undefined,
      walkMaxMinutes: walkMaxMinutes as SearchConditions["walkMaxMinutes"],
      directions: areaMode === "station" ? directions : [],
      periodYears: 3,
      includeUnsettled: false,
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">エリア</p>
            <Tabs value={areaMode} onValueChange={(v) => setAreaMode(v as "station" | "city")}>
              <TabsList>
                <TabsTrigger value="station">駅から探す</TabsTrigger>
                <TabsTrigger value="city">市区町村から探す</TabsTrigger>
              </TabsList>
            </Tabs>
            {areaMode === "station" ? (
              <div className="relative w-72">
                <Input
                  value={stationQuery}
                  onChange={(e) => {
                    setStationQuery(e.target.value);
                    setStation(null);
                  }}
                  placeholder="駅名を入力（例: 大船）"
                />
                {stationHits.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {stationHits.map((s) => (
                      <li key={s.code}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setStation(s);
                            setStationQuery(s.name);
                            setStationHits([]);
                          }}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {s.lines.slice(0, 3).join("・")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={prefCode} onValueChange={(v) => v && setPrefCode(v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue>{PREFECTURES.find((p) => p.code === prefCode)?.name}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PREFECTURES.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cityCode} onValueChange={(v) => v && setCityCode(v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="市区町村">
                      {cityOptions.find((c) => c.id === cityCode)?.name ?? "市区町村"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">種別</p>
            <div className="flex gap-2">
              {PROPERTY_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant={propertyType === t.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPropertyType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            {isLand && (
              <p className="text-xs text-amber-600">
                土地は取引価格ベースで検索します（成約価格データは提供されていません）
              </p>
            )}
          </div>

          {!isLand && (
            <RangeSelect
              label="築年数"
              unit="年"
              options={AGE_OPTIONS}
              min={ageMin}
              max={ageMax}
              onMin={setAgeMin}
              onMax={setAgeMax}
            />
          )}
          <RangeSelect
            label="面積"
            unit="㎡"
            options={AREA_OPTIONS}
            min={areaMin}
            max={areaMax}
            onMin={setAreaMin}
            onMax={setAreaMax}
          />

          {areaMode === "station" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">駅からの徒歩（概算）</p>
              <Select value={String(walkMaxMinutes)} onValueChange={(v) => v && setWalkMaxMinutes(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue>{walkMaxMinutes}分以内</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {WALK_OPTIONS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w}分以内
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {areaMode === "station" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              方角（駅から見た向き・複数選択可）
              <span className="ml-2 font-normal text-muted-foreground">未選択＝全方位</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DIRECTIONS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={directions.includes(d) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDirection(d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={!canSearch || searching} size="lg">
            {searching ? "国交省データを取得中…" : "相場を調べる"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={savePreset}>
            {presetSaved ? "✓ 保存しました" : "この条件を既定にする"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RangeSelect({
  label,
  unit,
  options,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  unit: string;
  options: number[];
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-1">
        <Select value={min} onValueChange={(v) => v && onMin(v)}>
          <SelectTrigger className="w-28">
            <SelectValue>{min === NONE ? "下限なし" : `${min}${unit}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>下限なし</SelectItem>
            {options.map((o) => (
              <SelectItem key={o} value={String(o)}>
                {o}
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">〜</span>
        <Select value={max} onValueChange={(v) => v && onMax(v)}>
          <SelectTrigger className="w-28">
            <SelectValue>{max === NONE ? "上限なし" : `${max}${unit}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>上限なし</SelectItem>
            {options.map((o) => (
              <SelectItem key={o} value={String(o)}>
                {o}
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
