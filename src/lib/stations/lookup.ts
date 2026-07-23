import stations from "../../../data/stations.json";

export interface Station {
  code: string;
  name: string;
  lines: string[];
  lat: number;
  lng: number;
}

const ALL = stations as Station[];
const byCode = new Map(ALL.map((s) => [s.code, s]));

export function findStation(code: string): Station | undefined {
  return byCode.get(code);
}

// XPT001 の geometry（物件の最寄り駅の座標）から最寄駅名を逆引きする。
// 全国9048駅の線形探索だが、緯度±0.5°の粗いbboxで事前に絞ってから最近傍を選ぶ。
// 駅コード体系の丸め等でぴったり一致しない場合があるため、300m以内の一致のみ採用する。
const NEAREST_MAX_METERS = 300;

export interface NearestStationResult {
  station: Station;
  meters: number;
}

export function findNearestStation(lng: number, lat: number): NearestStationResult | null {
  const candidates = ALL.filter((s) => Math.abs(s.lat - lat) < 0.5 && Math.abs(s.lng - lng) < 0.5);
  const pool = candidates.length > 0 ? candidates : ALL;

  let best: Station | null = null;
  let bestMeters = Infinity;
  for (const s of pool) {
    // 事前フィルタなので簡易な平面近似で十分（最終距離は呼び出し側のhaversineで出す想定だが、ここでは選定用に近似）
    const dLat = (s.lat - lat) * 111_320;
    const dLng = (s.lng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180);
    const meters = Math.sqrt(dLat * dLat + dLng * dLng);
    if (meters < bestMeters) {
      bestMeters = meters;
      best = s;
    }
  }
  if (!best || bestMeters > NEAREST_MAX_METERS) return null;
  return { station: best, meters: bestMeters };
}
