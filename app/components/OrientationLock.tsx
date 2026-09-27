"use client";

import { useEffect } from "react";

/**
 * Attempts to lock the screen orientation to portrait using the
 * Screen Orientation API. Silently fails on iOS and browsers/contexts
 * where the lock is unavailable (requires fullscreen or PWA mode on many).
 * The PWA manifest's `orientation: "portrait-primary"` already handles
 * installed Android PWA sessions at the OS level.
 */
export function OrientationLock() {
  useEffect(() => {
    try {
      screen.orientation?.lock?.("portrait").catch(() => {});
    } catch {
      // Unsupported — ignore.
    }
  }, []);
  return null;
}
