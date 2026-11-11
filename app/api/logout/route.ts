import { authRedirect, isSameOrigin } from "../../lib/session";

export function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  return authRedirect("/", "");
}
