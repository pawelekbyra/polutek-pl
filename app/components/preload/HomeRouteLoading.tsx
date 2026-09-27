"use client";

import { SitePreloaderScreen } from "./SitePreloaderScreen";
import { shouldSkipGate } from "./PageRevealGate";

/**
 * Next.js Suspense fallback for the home route.
 *
 * First visit (no sessionStorage key): full SitePreloaderScreen — continuous
 * with PageRevealGate so the viewer never sees a flash between SSR and the gate.
 *
 * Any subsequent navigation in the same browser session: returns null so the
 * back-button / language-switch / logo-click transitions don't re-show the
 * full preloader.
 */
export function HomeRouteLoading() {
  if (shouldSkipGate()) return null;
  return <SitePreloaderScreen />;
}
