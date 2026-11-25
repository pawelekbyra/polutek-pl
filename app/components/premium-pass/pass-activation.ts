"use client";
// patron zone (docs/architecture/patron-zone.md, "Premium od razu po płatności"): one page-wide signal that the
// viewer's Premium access has just been recorded on the server (the checkout saw the payment as SUCCEEDED through the
// payment-status endpoint, which checks Stripe itself). Every surface that shows the access listens and asks the
// server again: the avatar ring and role (Navbar), the Hero button, the video gate (PremiumPassOverlay), the account
// panel, the preloaded playback plans, the server-rendered parts (router.refresh) and the comment badges.
// The event carries nothing and grants nothing: each listener re-reads its own data from the server.
import { useEffect, useRef } from "react";

export const PASS_ACTIVATED_EVENT = "polutek:premium-pass-activated";

export function announcePassActivated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PASS_ACTIVATED_EVENT));
}

/** Runs `handler` every time the access was activated on this page (the latest handler, no re-subscription). */
export function usePassActivated(handler: () => void, enabled = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const listener = () => ref.current();
    window.addEventListener(PASS_ACTIVATED_EVENT, listener);
    return () => window.removeEventListener(PASS_ACTIVATED_EVENT, listener);
  }, [enabled]);
}
