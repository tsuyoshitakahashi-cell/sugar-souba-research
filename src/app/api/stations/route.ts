import { NextRequest, NextResponse } from "next/server";
import stations from "../../../../data/stations.json";

interface Station {
  code: string;
  name: string;
  lines: string[];
}

const all = stations as Station[];

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length === 0) return NextResponse.json({ stations: [] });

  const prefix = all.filter((s) => s.name.startsWith(q));
  const partial = q.length >= 2 ? all.filter((s) => !s.name.startsWith(q) && s.name.includes(q)) : [];
  return NextResponse.json({ stations: [...prefix, ...partial].slice(0, 20) });
}
