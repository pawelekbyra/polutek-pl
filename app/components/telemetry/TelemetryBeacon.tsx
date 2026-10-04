"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/react";
import {
  configureBeacon,
  flushBeacon,
  hasActivePlayback,
  isBeaconEnabled,
  queuePageView,
  queueWebVital,
} from "@/lib/telemetry/client/beacon-queue";
import type { BeaconPageView, BeaconWebVital } from "@/lib/telemetry/beacon-contract";

/** First beacon this long after load (page view + early vitals), unless the page is hidden sooner. */
const FIRST_FLUSH_MS = 10_000;
/** During long playback, report watch time and quality this often. */
const PLAYBACK_FLUSH_MS = 5 * 60_000;

function currentPageView(pathname: string): BeaconPageView {
  const params = new URLSearchParams(window.location.search);
  const utm = (key: string) => params.get(key)?.slice(0, 64) || undefined;
  const lang = document.documentElement.lang?.slice(0, 2).toLowerCase();
  return {
    path: pathname,
    referrer: document.referrer || undefined,
    utmSource: utm("utm_source"),
    utmMedium: utm("utm_medium"),
    utmCampaign: utm("utm_campaign"),
    lang: lang && /^[a-z]{2}$/.test(lang) ? lang : undefined,
  };
}

/**
 * Anonymous, cookie-free statistics (privacy policy, "Statystyki"): page views, Web Vitals and video
 * playback quality, sent to /api/t. Renders nothing. `enabled` comes from the server
 * (lib/telemetry/config.ts); Do Not Track / Global Privacy Control turn it off in the browser.
 */
export function TelemetryBeacon({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    configureBeacon({ enabled, signedIn: isLoaded && isSignedIn === true });
  }, [enabled, isLoaded, isSignedIn]);

  // One page view per path (video switches on the home page change only ?v=, which is not a page view).
  useEffect(() => {
    if (!enabled) return;
    // The effect above (declared first, so it runs first) has already configured the queue.
    if (isBeaconEnabled() && pathname) queuePageView(currentPageView(pathname));
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushBeacon(false);
    };
    const onPageHide = () => flushBeacon(true);

    // Web Vitals first, then our listeners: web-vitals reports LCP/CLS/INP on visibilitychange, so its
    // handlers must run before ours flushes the queue.
    void import("web-vitals")
      .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        if (cancelled) return;
        const report = (metric: { name: string; value: number; rating?: string; navigationType?: string }) =>
          queueWebVital({
            name: metric.name as BeaconWebVital["name"],
            value: Math.max(0, metric.value),
            rating: metric.rating as BeaconWebVital["rating"],
            navigationType: metric.navigationType,
            path: window.location.pathname,
          });
        onCLS(report);
        onFCP(report);
        onINP(report);
        onLCP(report);
        onTTFB(report);
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        document.addEventListener("visibilitychange", onHidden);
        window.addEventListener("pagehide", onPageHide);
      });

    const first = window.setTimeout(() => flushBeacon(false), FIRST_FLUSH_MS);
    const periodic = window.setInterval(() => {
      if (hasActivePlayback() && document.visibilityState === "visible") flushBeacon(false);
    }, PLAYBACK_FLUSH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(periodic);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enabled]);

  return null;
}
