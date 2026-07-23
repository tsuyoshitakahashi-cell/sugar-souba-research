// 国土数値情報 N02（鉄道）駅GeoJSONから駅コード表を生成する
// 使い方: node scripts/build-stations.mjs <N02-XX_Station.geojson>
// 出力: data/stations.json  [{ code, name, lines: [], lat, lng }]
// code = N02_005g（グループコード）。XIT001/XPT001 の駅特定に使う値。
// lat/lng = 同一グループの全駅LineString頂点の平均（代表点）。XPT001の距離計算に使用。
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
  const entry = byGroup.get(code) ?? { code, name: p.N02_005, lines: new Set(), sumLng: 0, sumLat: 0, n: 0 };
  entry.lines.add(p.N02_003);
  // geometry は LineString（[lng, lat] の配列）。全頂点を平均して代表点にする
  for (const [lng, lat] of f.geometry.coordinates) {
    entry.sumLng += lng;
    entry.sumLat += lat;
    entry.n += 1;
  }
  byGroup.set(code, entry);
}

const round6 = (v) => Math.round(v * 1e6) / 1e6;
const stations = [...byGroup.values()]
  .map((s) => ({
    code: s.code,
    name: s.name,
    lines: [...s.lines].sort(),
    lat: round6(s.sumLat / s.n),
    lng: round6(s.sumLng / s.n),
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

mkdirSync("data", { recursive: true });
writeFileSync("data/stations.json", JSON.stringify(stations));
console.log(`data/stations.json: ${stations.length} stations (from ${geojson.features.length} features)`);
