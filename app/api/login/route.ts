import { authRedirect, isAuthConfigured, isSameOrigin, loginWithPassword } from "../../lib/session";

// Multi-instance hosting needs a shared rate limit for POST /api/login at the edge.
const failureLimit = 8;
const windowMs = 60_000;
let failures = 0;
let resetAt = 0;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (!isAuthConfigured()) return new Response("Logowanie jest niedostępne.", { status: 503 });
  if (failures >= failureLimit && Date.now() < resetAt) return authRedirect("/?login=limited", null);

  const form = await request.formData().catch(() => null);
  const password = form?.get("password");

  const now = Date.now();
  if (now >= resetAt) {
    failures = 0;
    resetAt = now + windowMs;
  }
  if (failures >= failureLimit) return authRedirect("/?login=limited", null);

  const token = typeof password === "string" && password.length <= 256 ? loginWithPassword(password) : null;
  if (token) return authRedirect("/", token);

  failures++;
  return authRedirect("/?login=invalid", null);
}
