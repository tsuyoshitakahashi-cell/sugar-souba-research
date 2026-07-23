import { NextRequest, NextResponse } from "next/server";
import cities from "../../../../data/cities.json";

interface PrefCities {
  prefCode: string;
  prefName: string;
  cities: { id: string; name: string }[];
}

const all = cities as PrefCities[];

export function GET(req: NextRequest) {
  const pref = req.nextUrl.searchParams.get("pref");
  const entry = all.find((p) => p.prefCode === pref);
  if (!entry) return NextResponse.json({ error: "都道府県コードが不正です" }, { status: 400 });
  return NextResponse.json({ cities: entry.cities });
}
