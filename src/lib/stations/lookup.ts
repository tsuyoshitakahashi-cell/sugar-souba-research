import stations from "../../../data/stations.json";

export interface Station {
  code: string;
  name: string;
  lines: string[];
  lat: number;
  lng: number;
}

const byCode = new Map((stations as Station[]).map((s) => [s.code, s]));

export function findStation(code: string): Station | undefined {
  return byCode.get(code);
}
