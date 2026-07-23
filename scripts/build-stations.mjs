// 国土数値情報 N02（鉄道）駅GeoJSONから駅コード表を生成する
// 使い方: node scripts/build-stations.mjs <N02-XX_Station.geojson>
// 出力: data/stations.json  [{ code, name, lines: [] }]
// code = N02_005g（グループコード）。XIT001 の station パラメータに渡す値。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-stations.mjs <N02-XX_Station.geojson>");
  process.exit(1);
}

const geojson = JSON.parse(readFileSync(src, "utf8"));
const byGroup = new Map();
for (const f of geojson.features) {
  const p = f.properties;
  const code = p.N02_005g;
  const entry = byGroup.get(code) ?? { code, name: p.N02_005, lines: new Set() };
  entry.lines.add(p.N02_003);
  byGroup.set(code, entry);
}

const stations = [...byGroup.values()]
  .map((s) => ({ code: s.code, name: s.name, lines: [...s.lines].sort() }))
  .sort((a, b) => a.code.localeCompare(b.code));

mkdirSync("data", { recursive: true });
writeFileSync("data/stations.json", JSON.stringify(stations));
console.log(`data/stations.json: ${stations.length} stations (from ${geojson.features.length} features)`);
