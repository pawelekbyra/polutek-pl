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
import type { WarpStart } from "./GateWarp";
import { preloadGateSound, startGateSound } from "./gate-sound";
import { pupilOnScreen } from "./gate-warp-timeline";
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
 * A progress bar is on screen from the first paint (server HTML). Phases:
 * - covering: the page underneath is still settling (auth loaded, player ready, comments); only
 *   the bar, no prompt, no rabbit and nothing to click yet;
 * - gate: settled, or {@link PAGE_REVEAL_MAX_WAIT_MS} from navigation start passed; the rabbit
 *   appears in the screen centre with the prompt above and "ENTER" below, and a click on rabbit or
 *   caption enters;
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

type Phase = "covering" | "gate" | "warp" | "leaving" | "done";

/** The warp needs motion and a canvas; otherwise (reduced motion, no canvas) the plain fade. */
function canWarp(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return !!document.createElement("canvas").getContext("2d");
  } catch {
    return false;
  }
}

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
  const [readyKeys, setReadyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [warpStart, setWarpStart] = useState<WarpStart | null>(null);

  useLayoutEffect(() => {
    if (shouldSkipGate()) setPhase("done");
  }, []);

  // The entry button (rabbit + "ENTER") appears when the page is ready and takes the keyboard focus,
  // so Enter/Space enters without a mouse.
  useEffect(() => {
    if (phase !== "gate") return;
    const button = document.querySelector<HTMLElement>("[data-gate-enter]");
    button?.focus({ preventScroll: true });
  }, [phase]);

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

  // Real progress for the bar: auth plus every awaited piece, as the share that has settled.
  const awaited = waitForKey.split("|").filter(Boolean);
  const settled = (authLoaded ? 1 : 0) + awaited.filter((key) => readyKeys.has(key)).length;
  const progress = settled / (awaited.length + 1);

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

  // The click on the rabbit / "ENTER": the warp (zoom into the eye, the hole, the tunnel of code,
  // the flash) with its sound, or the plain fade when motion is reduced. The hero gets the click's
  // permission to play with sound now ("polutek:gate-unlock") and starts at the flash
  // ("polutek:gate-enter"), so the two sounds never overlap.
  const enter = useCallback(() => {
    const rabbit = document.querySelector<HTMLElement>("[data-gate-enter] img");
    const box = rabbit?.getBoundingClientRect();
    if (!canWarp() || !box || box.width === 0) {
      window.dispatchEvent(new Event("polutek:gate-enter"));
      setPhase("leaving");
      return;
    }
    window.dispatchEvent(new Event("polutek:gate-unlock"));
    setWarpStart({ pupil: pupilOnScreen(box), clock: startGateSound() });
    setPhase("warp");
  }, []);

  const warpFlash = useCallback(() => {
    window.dispatchEvent(new Event("polutek:gate-enter"));
  }, []);
  const warpDone = useCallback(() => {
    hideGateFromNowOn();
    setPhase("done");
  }, []);

  // The sound loads while the viewer looks at the rabbit (never before the page is ready).
  useEffect(() => {
    if (phase === "gate" && canWarp()) void preloadGateSound();
  }, [phase]);

  // From the click on, a reload must not show the gate again.
  useEffect(() => {
    if (phase !== "warp") return;
    revealedInThisDocument = true;
    markGatePassed();
  }, [phase]);

  // covering → gate when the page is ready (or the max wait expired).
  useEffect(() => {
    if (covering && (allReady || timedOut)) setPhase("gate");
  }, [covering, allReady, timedOut]);

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
  }, [phase, enter]);

  const contextValue = useMemo(() => ({ reportReady }), [reportReady]);

  return (
    <PageRevealContext.Provider value={contextValue}>
      {/* The page underneath is not reachable (Tab, screen reader) while the modal gate is up
          (WCAG 2.4.3); `display: contents` keeps the layout untouched. */}
      <div style={{ display: "contents" }} inert={phase !== "done" || undefined}>
        {children}
      </div>
      {phase !== "done" && (
        <SitePreloaderScreen
          leaving={phase === "leaving"}
          failsafe={phase === "covering"}
          ready={phase !== "covering"}
          progress={progress}
          onEnter={handleEnterClick}
          warp={phase === "warp" && warpStart ? { start: warpStart, onFlash: warpFlash, onDone: warpDone } : null}
        />
      )}
    </PageRevealContext.Provider>
  );
}
