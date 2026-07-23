import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  const secret = process.env.SESSION_SECRET;
  if (!passcode || !secret) {
    return NextResponse.json({ error: "サーバ設定が不完全です" }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "試行回数が多すぎます。1分後にお試しください" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.passcode !== "string" || body.passcode !== passcode) {
    return NextResponse.json({ error: "パスコードが違います" }, { status: 401 });
  }

  const { token, maxAge } = await createSessionToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
