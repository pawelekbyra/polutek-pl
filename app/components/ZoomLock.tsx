"use client";

import { useEffect } from "react";

/**
 * Keeps the page from being zoomed with the fingers, like an app. The viewport tag (maximum-scale=1,
 * user-scalable=no) covers Chrome and Android; iOS Safari ignores it, so the same is enforced here:
 * `gesturestart` (the Safari pinch), a two-finger `touchmove`, and the double-tap zoom.
 *
 * Trade-off, decided by the owner: people who rely on browser zoom cannot use it on this site.
 * Text size follows the system setting, which is not affected.
 */
export function ZoomLock() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    const blockPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    let lastTap = 0;
    const blockDoubleTap = (event: TouchEvent) => {
      const now = Date.now();
      if (event.touches.length === 1 && now - lastTap < 300) event.preventDefault();
      lastTap = now;
    };
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    document.addEventListener("touchmove", blockPinch, { passive: false });
    document.addEventListener("touchstart", blockDoubleTap, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("touchmove", blockPinch);
      document.removeEventListener("touchstart", blockDoubleTap);
    };
  }, []);
  return null;
}
