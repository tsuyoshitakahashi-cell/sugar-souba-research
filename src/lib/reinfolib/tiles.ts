// XYZ タイル座標変換と地理計算（XPT001 のタイル指定・距離・方位に使用）

export const TILE_ZOOM = 13; // XPT001 のズーム範囲11〜15の中間。1タイル≈4.8km四方（緯度35度付近）
export const WALK_METERS_PER_MINUTE = 80; // 不動産表示の慣例（80m/分）

export interface Tile {
  z: number;
  x: number;
  y: number;
}

export function lngLatToTile(lng: number, lat: number, z: number = TILE_ZOOM): Tile {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { z, x, y };
}

const MAX_TILES = 30; // 異常に広いbboxで大量リクエストを送らないための安全弁

function tilesInBBox(minLng: number, minLat: number, maxLng: number, maxLat: number, z: number): Tile[] {
  const nw = lngLatToTile(minLng, maxLat, z);
  const se = lngLatToTile(maxLng, minLat, z);
  const tiles: Tile[] = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      tiles.push({ z, x, y });
      if (tiles.length >= MAX_TILES) return tiles;
    }
  }
  return tiles;
}

// 中心座標＋半径(m)を覆うタイル群を列挙する
export function tilesCoveringRadius(lng: number, lat: number, radiusMeters: number, z: number = TILE_ZOOM): Tile[] {
  // 緯度経度の度あたりメートル（概算）で半径をbboxに変換
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return tilesInBBox(lng - dLng, lat - dLat, lng + dLng, lat + dLat, z);
}

// 市区町村など矩形範囲（緯度経度bbox）を覆うタイル群を列挙する。少し余白(margin)を持たせる。
export function tilesCoveringBounds(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  z: number = TILE_ZOOM,
  marginMeters = 500,
): Tile[] {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const dLat = marginMeters / 111_320;
  const dLng = marginMeters / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return tilesInBBox(
    bounds.minLng - dLng,
    bounds.minLat - dLat,
    bounds.maxLng + dLng,
    bounds.maxLat + dLat,
    z,
  );
}

// Haversine 距離（メートル）
export function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function metersToWalkMinutes(meters: number): number {
  return Math.ceil(meters / WALK_METERS_PER_MINUTE);
}

export const DIRECTIONS_8 = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"] as const;
export type Direction8 = (typeof DIRECTIONS_8)[number];

// from（駅）から to（物件地区）への方位を8方位で返す
export function bearingToDirection8(fromLng: number, fromLat: number, toLng: number, toLat: number): Direction8 {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δλ = toRad(toLng - fromLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI; // -180..180、北=0、東=90
  const normalized = (bearing + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return DIRECTIONS_8[index];
}
