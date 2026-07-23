// 国交省「位置参照情報（大字・町丁目レベル）」CSV群から町丁目の代表座標表を生成する
// 使い方: node scripts/build-districts.mjs <CSVを含むディレクトリ>
// 出力: data/districts.json  { "<市区町村コード>|<大字名>": [lat, lng] }
//   XPT001 の (city_code, district_name_ja) と突合し、駅→町丁目中心の距離・方角を概算するために使う。
//   「N丁目」を除いた大字名でグルーピングし、丁目centroidを平均して代表点にする。
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/build-districts.mjs <dir-with-csv>");
  process.exit(1);
}

const CHOME_SUFFIX = /[一二三四五六七八九十０-９0-9]+丁目$/;
const groups = new Map(); // key -> {sumLat, sumLng, n}

const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".csv"));
for (const file of files) {
  // 位置参照情報は Shift-JIS
  const text = readFileSync(join(dir, String(file)), "latin1"); // 後で TextDecoder で正規化
  const buf = readFileSync(join(dir, String(file)));
  const decoded = new TextDecoder("shift-jis").decode(buf);
  const lines = decoded.split("\n").slice(1);
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const c = ln.split(",").map((s) => s.replace(/^"|"$/g, ""));
    const city = c[2];
    const name = c[5];
    const lat = Number(c[6]);
    const lng = Number(c[7]);
    if (!city || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const bare = name.replace(CHOME_SUFFIX, "");
    const key = `${city}|${bare}`;
    const g = groups.get(key) ?? { sumLat: 0, sumLng: 0, n: 0 };
    g.sumLat += lat;
    g.sumLng += lng;
    g.n += 1;
    groups.set(key, g);
  }
  void text;
}

const round6 = (v) => Math.round(v * 1e6) / 1e6;
const out = {};
for (const [key, g] of groups) {
  out[key] = [round6(g.sumLat / g.n), round6(g.sumLng / g.n)];
}

mkdirSync("data", { recursive: true });
writeFileSync("data/districts.json", JSON.stringify(out));
console.log(`data/districts.json: ${Object.keys(out).length} districts from ${files.length} files`);
