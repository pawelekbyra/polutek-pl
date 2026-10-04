"use client";

import { useLayoutEffect, useState } from "react";
import { SitePreloaderScreen } from "./SitePreloaderScreen";
import { shouldSkipGate } from "./PageRevealGate";
import { queueGateEnter } from "./matrix-rain-engine";

/**
 * Next.js Suspense fallback for the home route.
 *
 * First visit: the full gate screen, identical to the one `PageRevealGate` renders, so the
 * hand-over is invisible. The page is not there yet, so the button is in its "loading" state and
 * a click is queued for the gate.
 *
 * Once the viewer entered (this document or tab session) it renders nothing. The first render
 * still matches the server HTML (the server cannot see sessionStorage); the switch happens before
 * paint, and `data-gate-passed` on <html> hides the screen by CSS until then.
 */
export function HomeRouteLoading() {
  const [skip, setSkip] = useState(false);
  useLayoutEffect(() => {
    if (shouldSkipGate()) setSkip(true);
  }, []);
  if (skip) return null;
  return <SitePreloaderScreen failsafe onEnter={queueGateEnter} />;
}
