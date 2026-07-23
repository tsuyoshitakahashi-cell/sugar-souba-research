// XIT002 から全都道府県の市区町村コード表を生成する
// 使い方: REINFOLIB_API_KEY=... node scripts/build-cities.mjs
// 出力: data/cities.json  [{ prefCode, prefName, cities: [{ id, name }] }]
import { writeFileSync, mkdirSync } from "node:fs";

const apiKey = process.env.REINFOLIB_API_KEY;
if (!apiKey) {
  console.error("REINFOLIB_API_KEY が未設定です");
  process.exit(1);
}

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = [];

for (let i = 1; i <= 47; i++) {
  if (i > 1) await sleep(800); // レート配慮
  const res = await fetch(`https://www.reinfolib.mlit.go.jp/ex-api/external/XIT002?area=${String(i).padStart(2, "0")}`, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });
  if (!res.ok) {
    console.error(`pref ${i}: HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  result.push({ prefCode: String(i).padStart(2, "0"), prefName: PREFECTURES[i - 1], cities: body.data });
  console.log(`${PREFECTURES[i - 1]}: ${body.data.length}`);
}

mkdirSync("data", { recursive: true });
writeFileSync("data/cities.json", JSON.stringify(result));
console.log(`data/cities.json: ${result.length} prefectures`);
