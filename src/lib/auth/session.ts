const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "session";

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  // Edge runtime に Buffer がないため btoa で base64url 化
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSessionToken(secret: string): Promise<{ token: string; maxAge: number }> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const sig = await hmac(secret, String(expiresAt));
  return { token: `${expiresAt}.${sig}`, maxAge: SESSION_DURATION_MS / 1000 };
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [expiresAt, sig] = token.split(".");
  if (!expiresAt || !sig) return false;
  if (Number(expiresAt) < Date.now()) return false;
  const expected = await hmac(secret, expiresAt);
  return sig === expected;
}
