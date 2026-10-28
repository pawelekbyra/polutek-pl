"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { withRealUrl } from "@/lib/i18n/real-location";

/**
 * Public URL masking.
 *
 * The owner wants the address bar to always read `pawelperfect.com` while browsing
 * the channel — home, a shared `?v=` video link, `/watch/*`, `/channel/*`,
 * `/search`, `/regulamin`, etc. all resolve normally on the server, but once the
 * client has mounted the visible URL is collapsed to `/`.
 *
 * Only a small allowlist keeps a real, copyable URL:
 *   - the legal pages (regulamin / polityka-prywatnosci and their /en aliases)
 *   - system/non-public routes (admin cockpit, API, auth callback, unsubscribe)
 *
 * Masking is purely cosmetic: it uses `history.replaceState` with Next's own
 * history state object so the App Router's client navigation keeps working. A
 * shared deep link still opens the correct content on first load — only the
 * bar is rewritten afterwards, which the owner accepted (video links stop being
 * copyable from the address bar).
 *
 * The real page is not lost: before the address is collapsed, its path and query are written into the
 * history entry's state (lib/i18n/real-location.ts), so the language switcher can open the same
 * channel / search / playlist / video in another language instead of the home page.
 */
const KEEP_URL_PATTERNS: RegExp[] = [
  // Legal pages keep their own address.
  /^\/regulamin\/?$/,
  /^\/polityka-prywatnosci\/?$/,
  /^\/(?:en|de|es|fr|it|pt|zh)\/terms\/?$/,
  /^\/(?:en|de|es|fr|it|pt|zh)\/privacy-policy\/?$/,
  // TEMPORARY logo font bake-off pages keep their /logoN address so they can be
  // compared. Remove alongside the experiment.
  /^\/logo\d+\/?$/,
  // Non-public / system routes must never be collapsed to "/".
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/sso-callback(?:\/|$)/,
  /^\/unsubscribe(?:\/|$)/,
  // The embeddable player lives in other sites' iframes: its address must stay what the embed code says.
  /^\/embed\//,
];

function shouldKeepUrl(pathname: string): boolean {
  return KEEP_URL_PATTERNS.some((pattern) => pattern.test(pathname));
}

// Payment-return params must survive until the tip gate (SupportModal) has read them and
// cleaned the URL itself; stripping them here would swallow the Stripe return handoff.
const PRESERVE_QUERY_KEYS = ["success", "payment_id"];

function hasPreservedQuery(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return PRESERVE_QUERY_KEYS.some((key) => params.has(key));
}

function UrlMaskEffect() {
  const pathname = usePathname();
  // Subscribing to search params ensures a query-only change (e.g. picking a
  // video, which pushes `/?v=slug` without changing the pathname) re-runs the
  // masking effect.
  useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (shouldKeepUrl(pathname)) return;

    const { pathname: currentPath, search, hash } = window.location;
    // Already a clean root URL — nothing to rewrite.
    if (currentPath === "/" && search === "" && hash === "") return;
    // Defer to the tip gate on Stripe payment returns; it clears the URL itself.
    if (hasPreservedQuery(search)) return;

    try {
      // Preserve Next's history state object so the App Router client router
      // stays consistent; only the visible URL changes.
      window.history.replaceState(withRealUrl(window.history.state, { pathname: currentPath, search }), "", "/");
    } catch {
      // Masking is cosmetic — never let it break navigation.
    }
  }, [pathname]);

  return null;
}

export function UrlMask() {
  // useSearchParams requires a Suspense boundary; fall back to nothing.
  return (
    <Suspense fallback={null}>
      <UrlMaskEffect />
    </Suspense>
  );
}

export default UrlMask;
