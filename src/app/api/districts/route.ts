import { NextRequest, NextResponse } from "next/server";
import { listDistricts } from "@/lib/districts/lookup";

export function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!city) return NextResponse.json({ error: "市区町村コードが必要です" }, { status: 400 });
  return NextResponse.json({ districts: listDistricts(city) });
}
