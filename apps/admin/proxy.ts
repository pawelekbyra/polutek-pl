import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_PREFIX, getAccessConfig, getAdminOrigin } from "@admin/lib/config";
import { isTranslatorPath, lookupSessionRole } from "@admin/lib/auth/roles";
import { verifyAccessRequest } from "@admin/lib/security/cf-access";
import { buildCsp, createNonce } from "@admin/lib/security/csp";
import { checkPanelCsrf } from "@admin/lib/security/csrf";

/**
 * Front door of the panel (Next.js 16 proxy, Node runtime), in this order:
 *  1. /api/health answers without anything else (container healthcheck on 127.0.0.1).
 *  2. Cloudflare Access JWT must verify (layer 1); otherwise 403 and nothing else runs.
 *  3. Mutations must come from the exact panel origin (CSRF).
 *  4. Pages get a fresh nonce + strict CSP and `no-store`.
 * The session itself (layer 2) is checked by the pages and the auth handler, not here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/health") return NextResponse.next();

  const access = await verifyAccessRequest(request.headers, getAccessConfig());
  if (!access.ok) {
    console.warn(`[admin-proxy] access denied: ${access.reason}${access.detail ? ` (${access.detail})` : ""} ${request.method} ${pathname}`);
    return denied(access.reason === "not_configured" ? 503 : 403);
  }

  const csrf = checkPanelCsrf(request.method, request.headers, getAdminOrigin());
  if (!csrf.ok) {
    console.warn(`[admin-proxy] csrf refused: ${csrf.reason} ${request.method} ${pathname}`);
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  // A TRANSLATOR account reaches only the translation screens. Checked here, on every request (soft navigations
  // fetch their page from the server too), so a new page added by someone else is closed to translators by default.
  if (!isTranslatorPath(pathname)) {
    const cookieName = process.env.NODE_ENV === "production" ? `__Host-${ADMIN_COOKIE_PREFIX}.session_token` : `${ADMIN_COOKIE_PREFIX}.session_token`;
    const cookie = request.cookies.get(cookieName)?.value;
    const role = cookie ? await lookupSessionRole(cookie).catch(() => null) : null;
    if (role === "TRANSLATOR") {
      console.warn(`[admin-proxy] translator outside its screens: ${request.method} ${pathname}`);
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
      return NextResponse.redirect(new URL("/tlumaczenia", request.url));
    }
  }

  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    res.headers.set("cache-control", "private, no-store");
    return res;
  }

  const nonce = createNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  // The page guards use it as the return target after sign-in (validated by safeNextPath).
  requestHeaders.set("x-panel-path", `${pathname}${request.nextUrl.search}`);
  if (access.email) requestHeaders.set("x-panel-access-email", access.email);
  else requestHeaders.delete("x-panel-access-email");

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  res.headers.set("cache-control", "private, no-store");
  return res;
}

function denied(status: 403 | 503) {
  const body =
    status === 503
      ? "Panel nie jest skonfigurowany (Cloudflare Access). Szczegóły w logu kontenera."
      : "Brak dostępu. Panel jest dostępny tylko przez Cloudflare Access.";
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
