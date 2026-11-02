"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/** Below this width the notification panel is a bottom sheet; from 768 px up it is the popover under the bell. */
export const NOTIFICATION_SHEET_QUERY = "(max-width: 767.98px)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(NOTIFICATION_SHEET_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}
const snapshot = () => typeof window.matchMedia === "function" && window.matchMedia(NOTIFICATION_SHEET_QUERY).matches;

/** True on phone widths. The server and the first hydration pass say false (the panel is closed then, so nothing flashes). */
export function useIsNotificationSheet(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * Gives the open sheet its own history entry so the browser Back button (Android, iOS edge swipe) closes the sheet
 * instead of leaving the page. Closing any other way (scrim, swipe, Esc, close button, link) pops that entry again.
 * The entry reuses the current URL and keeps the existing history state, so the Next.js router is not disturbed.
 */
export function useSheetHistory(active: boolean, onBack: () => void) {
  const pushed = useRef(false);
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });
  useEffect(() => {
    if (!active) return;
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      window.history.pushState({ ...(window.history.state ?? {}), notificationSheet: entryId }, "");
    } catch { return; }
    pushed.current = true;
    const onPop = () => {
      // Still on this sheet's own entry (e.g. the late pop of a sheet that was closed a moment ago): not a Back from it.
      if (!pushed.current || window.history.state?.notificationSheet === entryId) return;
      pushed.current = false;
      onBackRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!pushed.current) return;
      pushed.current = false;
      window.history.back();
    };
  }, [active]);
}
