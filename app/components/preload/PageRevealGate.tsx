"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/react";
import { SitePreloaderScreen } from "./SitePreloaderScreen";
import { useOptionalTx } from "@/lib/i18n/language-context";

/**
 * Coordinated first reveal of the public home page.
 *
 * Once the page has settled (auth loaded, player buffered),
 * the preloader transitions to a "Follow the white rabbit" gate — the rain keeps
 * falling and the viewer must click the rabbit button to enter. Clicking triggers a
 * blur-fade exit and reveals the page underneath.
 *
 * It never blocks forever: the gate appears after {@link PAGE_REVEAL_MAX_WAIT_MS}
 * from navigation start whatever is still pending, and a CSS failsafe hides the
 * preloader after 30s even if JS never runs.
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

const SESSION_KEY = "polutek:revealed";

function hasRevealedThisSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}

function markRevealedThisSession() {
  revealedInThisDocument = true;
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
}

export function hasRevealedPageInThisDocument(): boolean {
  return revealedInThisDocument;
}

/** True if the gate should be skipped — used by HomeRouteLoading to avoid showing
 *  the full preloader during in-session back-navigations. */
export function shouldSkipGate(): boolean {
  return revealedInThisDocument || hasRevealedThisSession();
}

/** @internal test helper */
export function resetPageRevealForTests() {
  revealedInThisDocument = false;
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

export function usePageRevealReady(key: string | undefined, ready: boolean) {
  const context = useContext(PageRevealContext);
  useEffect(() => {
    if (key && ready) context?.reportReady(key);
  }, [context, key, ready]);
}

interface PageRevealGateProps {
  children: React.ReactNode;
  waitFor?: string[];
}

export function PageRevealGate({ children, waitFor = [] }: PageRevealGateProps) {
  const { isLoaded: authLoaded } = useAuth();
  const tx = useOptionalTx();

  // Phase machine: covering → gate (user sees rabbit) → leaving → done
  // Also check sessionStorage so auth redirects (Google sign-in) don't re-show the preloader.
  const [phase, setPhase] = useState<"covering" | "gate" | "leaving" | "done">(() =>
    revealedInThisDocument || hasRevealedThisSession() ? "done" : "covering"
  );
  const [timedOut, setTimedOut] = useState(false);
  const [readyKeys, setReadyKeys] = useState<ReadonlySet<string>>(() => new Set());

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

  // Max wait — once expired the gate appears even if things are still loading.
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

  // Transition covering → gate when content is ready or timed out.
  useEffect(() => {
    if (covering && (allReady || timedOut)) setPhase("gate");
  }, [covering, allReady, timedOut]);

  // Block body scroll and touch-scroll while the preloader is covering the page.
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [phase]);

  // Once leaving: wait for the blur-fade animation, then unmount.
  useEffect(() => {
    if (phase !== "leaving") return;
    markRevealedThisSession();
    const timer = window.setTimeout(() => setPhase("done"), LEAVE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const handleGateClick = useCallback(() => {
    if (phase !== "gate") return;
    // Best-effort orientation lock on user gesture (works in PWA standalone;
    // silently fails in regular browser tabs where fullscreen is not active).
    try { (screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> })?.lock?.("portrait").catch(() => {}); } catch { /* unsupported */ }
    window.dispatchEvent(new Event("polutek:gate-enter"));
    setPhase("leaving");
  }, [phase]);

  const contextValue = useMemo(() => ({ reportReady }), [reportReady]);

  return (
    <PageRevealContext.Provider value={contextValue}>
      {children}
      {phase !== "done" && (
        <SitePreloaderScreen
          leaving={phase === "leaving"}
          failsafe={phase === "covering"}
          label={tx("Ładowanie strony…", "Loading…")}
          showGate={phase === "gate"}
          onGateClick={handleGateClick}
        />
      )}
    </PageRevealContext.Provider>
  );
}
