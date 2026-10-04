"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/react";
import { SitePreloaderScreen } from "./SitePreloaderScreen";
import {
  consumeQueuedGateEnter,
  hasPassedGateThisSession,
  hideGateFromNowOn,
  markGatePassed,
  RAIN_CONFIG,
} from "./matrix-rain-engine";

/**
 * Entry gate of the public home page ("Follow the white rabbit").
 *
 * The prompt and the rabbit button are on screen from the first paint (server HTML). Phases:
 * - covering: the page underneath is still settling (auth loaded, player ready, comments); the
 *   button says "loading" and a click is queued;
 * - gate: settled, or {@link PAGE_REVEAL_MAX_WAIT_MS} from navigation start passed; a click
 *   (or a click queued earlier) enters;
 * - leaving: blur-fade exit; done: unmounted, no CPU left behind.
 * A CSS failsafe hides the screen after 30 s even if JS never runs. Once entered, the gate is
 * skipped for the rest of the tab session (sessionStorage + `data-gate-passed` on <html>, set
 * before the first paint by the boot script in the root layout).
 */

type PageRevealContextValue = {
  reportReady: (key: string) => void;
};

const PageRevealContext = createContext<PageRevealContextValue | null>(null);

export const PAGE_REVEAL_MAX_WAIT_MS = 6000;
export const PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS = 700;
// Duration of the blur-fade exit animation.
const LEAVE_ANIMATION_MS = 700;

let revealedInThisDocument = false;

/** True if the gate should be skipped (already entered in this document or tab session). */
export function shouldSkipGate(): boolean {
  return revealedInThisDocument || hasPassedGateThisSession();
}

/** @internal test helper */
export function resetPageRevealForTests() {
  revealedInThisDocument = false;
  try { sessionStorage.removeItem(RAIN_CONFIG.sessionKey); } catch {}
  document.documentElement.removeAttribute(RAIN_CONFIG.passedAttribute);
  consumeQueuedGateEnter();
}

export function usePageRevealReady(key: string | undefined, ready: boolean) {
  const context = useContext(PageRevealContext);
  useEffect(() => {
    if (key && ready) context?.reportReady(key);
  }, [context, key, ready]);
}

type Phase = "covering" | "gate" | "leaving" | "done";

interface PageRevealGateProps {
  children: React.ReactNode;
  waitFor?: string[];
}

export function PageRevealGate({ children, waitFor = [] }: PageRevealGateProps) {
  const { isLoaded: authLoaded } = useAuth();

  // Always "covering" on the first render so the client matches the server HTML; a viewer who
  // already entered is switched to "done" before paint (and CSS hides the screen meanwhile).
  const [phase, setPhase] = useState<Phase>("covering");
  const [timedOut, setTimedOut] = useState(false);
  const [enterQueued, setEnterQueued] = useState(false);
  const [readyKeys, setReadyKeys] = useState<ReadonlySet<string>>(() => new Set());

  useLayoutEffect(() => {
    if (shouldSkipGate()) {
      setPhase("done");
      return;
    }
    // A click on the rabbit before hydration (caught by the boot script) counts.
    if (consumeQueuedGateEnter()) setEnterQueued(true);
  }, []);

  const reportReady = useCallback((key: string) => {
    setReadyKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);
  const waitForKey = waitFor.join("|");
  const allReady =
    authLoaded &&
    waitForKey.split("|").every((key) => !key || readyKeys.has(key));

  const covering = phase === "covering";

  // Max wait: once expired the button enters even if something is still loading.
  useEffect(() => {
    if (!covering) return;
    const sinceNavigationStart =
      typeof performance !== "undefined" ? performance.now() : 0;
    const wait = Math.max(
      PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS,
      PAGE_REVEAL_MAX_WAIT_MS - sinceNavigationStart,
    );
    const timer = window.setTimeout(() => setTimedOut(true), wait);
    return () => window.clearTimeout(timer);
  }, [covering]);

  const enter = useCallback(() => {
    window.dispatchEvent(new Event("polutek:gate-enter"));
    setPhase("leaving");
  }, []);

  // covering → gate when the page is ready (or the max wait expired).
  useEffect(() => {
    if (covering && (allReady || timedOut)) setPhase("gate");
  }, [covering, allReady, timedOut]);

  // A click queued while loading enters as soon as the gate opens, never before.
  useEffect(() => {
    if (phase === "gate" && enterQueued) enter();
  }, [phase, enterQueued, enter]);

  // Block body scroll and touch-scroll while the gate is up.
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [phase]);

  // Once leaving: remember the entry, wait for the blur-fade, then unmount.
  useEffect(() => {
    if (phase !== "leaving") return;
    revealedInThisDocument = true;
    markGatePassed();
    const timer = window.setTimeout(() => {
      hideGateFromNowOn();
      setPhase("done");
    }, LEAVE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const handleEnterClick = useCallback(() => {
    // Best-effort orientation lock needs the click's own user activation (works in PWA
    // standalone; silently fails in regular browser tabs).
    try { (screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> })?.lock?.("portrait").catch(() => {}); } catch { /* unsupported */ }
    if (phase === "gate") enter();
    else if (phase === "covering") setEnterQueued(true);
  }, [phase, enter]);

  const contextValue = useMemo(() => ({ reportReady }), [reportReady]);

  return (
    <PageRevealContext.Provider value={contextValue}>
      {children}
      {phase !== "done" && (
        <SitePreloaderScreen
          leaving={phase === "leaving"}
          failsafe={phase === "covering"}
          ready={phase !== "covering"}
          onEnter={handleEnterClick}
        />
      )}
    </PageRevealContext.Provider>
  );
}
