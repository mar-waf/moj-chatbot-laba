import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sessionCookie = "laba_session";
const sessionSeconds = 8 * 60 * 60;

function getAuthConfig() {
  const password = process.env.CHAT_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password?.trim() || password.length > 256 || !secret || secret.trim().length < 32) return null;
  return { password, secret };
}

export function isAuthConfigured() {
  return getAuthConfig() !== null;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function sign(payload: string, { password, secret }: NonNullable<ReturnType<typeof getAuthConfig>>) {
  return createHmac("sha256", secret)
    .update("laba-session-v1:")
    .update(digest(password))
    .update(payload)
    .digest();
}

export function loginWithPassword(password: string) {
  const config = getAuthConfig();
  if (!config || !timingSafeEqual(digest(password), digest(config.password))) return null;

  const expires = Math.floor(Date.now() / 1000) + sessionSeconds;
  const payload = `${expires}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload, config).toString("hex")}`;
}

export function hasSession(token: string | undefined) {
  const config = getAuthConfig();
  if (!config || !token || !/^\d{1,12}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return false;

  const [expires, nonce, signature] = token.split(".");
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return false;

  return timingSafeEqual(Buffer.from(signature, "hex"), sign(`${expires}.${nonce}`, config));
}

export function authRedirect(location: string, token: string | null) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (token !== null) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const maxAge = token ? sessionSeconds : 0;
    headers.set("Set-Cookie", `${sessionCookie}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure}`);
  }
  return new Response(null, { status: 303, headers });
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  const url = URL.parse(origin);
  return url?.host === host && (url.protocol === "http:" || url.protocol === "https:");
}
