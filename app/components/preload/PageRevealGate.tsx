"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/react";
import { SitePreloaderScreen } from "./SitePreloaderScreen";
import type { WarpStart } from "./GateWarp";
import { preloadGateSound, primeGateSound, releaseGateSound, startGateSound } from "./gate-sound";
import { pupilOnScreen, rabbitBox } from "./gate-warp-timeline";
import { getRabbitVector, preloadRabbitVector, releaseRabbitVector } from "./rabbit-vector";
import { captureButton, capturePrompt, cursorBlinkPhase, showsHoverLook, type CapturedPrompt } from "./gate-scene";
import { prepareGateVoid, releaseGateVoid } from "./gate-void";
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

/** The prompt for the warp, its cursor blinking in step with the one on screen at the click. */
function withBlinkPhase(p: CapturedPrompt | null): CapturedPrompt | null {
  return p ? { ...p, blinkPhase: cursorBlinkPhase(document.querySelector<HTMLElement>("[data-gate-prompt]")) } : null;
}

/** The prepared prompt sprite, if the prompt is still exactly where it was when it was rendered. */
function freshPrompt(p: CapturedPrompt | null): CapturedPrompt | null {
  if (!p) return null;
  const el = document.querySelector<HTMLElement>("[data-gate-prompt]");
  const r = el?.getBoundingClientRect();
  if (!r) return null;
  const pad = (p.box.width - r.width) / 2;
  return Math.abs(r.left - (p.box.left + pad)) < 0.5 && Math.abs(r.top - (p.box.top + pad)) < 0.5 && Math.abs(r.width + pad * 2 - p.box.width) < 0.5 ? p : null;
}

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
  // The entry warp's sound and vector rabbit: loaded (and the sound decoded) while the gate is still
  // loading, so the click starts the warp at once, in sync and without a stutter. Counted as one
  // more awaited piece; the max wait still opens the gate if they are slow (then: a silent warp).
  const [warpAssetsReady, setWarpAssetsReady] = useState(false);

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
    warpAssetsReady &&
    waitForKey.split("|").every((key) => !key || readyKeys.has(key));

  const covering = phase === "covering";

  // Real progress for the bar: auth plus every awaited piece, as the share that has settled.
  const awaited = waitForKey.split("|").filter(Boolean);
  const settled = (authLoaded ? 1 : 0) + (warpAssetsReady ? 1 : 0) + awaited.filter((key) => readyKeys.has(key)).length;
  const progress = settled / (awaited.length + 2);

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

  // The click on the rabbit / "ENTER": the warp (zoom into the pupil, the black void, the flash)
  // with its sound, or the plain fade when motion is reduced. The click pauses the hero at its start
  // and gives it the permission to play with sound ("polutek:gate-unlock"); it starts from the
  // beginning when the flash covers the screen ("polutek:gate-enter"), so the sounds never overlap.
  // The prompt's sharp sprite (rendered with its halo at 4x resolution) costs real time to draw: it
  // is prepared as soon as ENTER appears, not inside the click (where it was a stutter on the first
  // frame). The click reuses it if the prompt has not moved since.
  const promptSprite = useRef<CapturedPrompt | null>(null);
  // Set when the gate goes away after an entry: the focus moves to the page content (see below).
  const focusMainWhenDone = useRef(false);
  const capturePromptNow = () =>
    capturePrompt(document.querySelector<HTMLElement>("[data-gate-prompt]"), Math.min(window.devicePixelRatio || 1, 1.5));
  useEffect(() => {
    if (phase !== "gate" || !canWarp()) return;
    let alive = true;
    const id = window.setTimeout(() => {
      // The tunnel's glyph sprites too: rendering them on the warp's first tunnel frame was a stall.
      prepareGateVoid();
      // Only once the prompt's font is in: a sprite drawn in the fallback font changed shape on the click.
      const fonts = typeof document.fonts?.ready?.then === "function" ? document.fonts.ready : Promise.resolve();
      void fonts.then(() => {
        if (alive) promptSprite.current = capturePromptNow();
      });
    }, 50);
    const refresh = () => {
      promptSprite.current = capturePromptNow();
    };
    window.addEventListener("resize", refresh);
    return () => {
      alive = false;
      window.clearTimeout(id);
      window.removeEventListener("resize", refresh);
    };
  }, [phase]);

  const enter = useCallback(() => {
    const rabbit = document.querySelector<HTMLElement>("[data-gate-rabbit] img");
    const box = rabbit?.getBoundingClientRect();
    if (!canWarp() || !box || box.width === 0) {
      window.dispatchEvent(new Event("polutek:gate-enter"));
      setPhase("leaving");
      return;
    }
    window.dispatchEvent(new Event("polutek:gate-unlock"));
    const data = getRabbitVector();
    setWarpStart({
      pupil: pupilOnScreen(box),
      clock: startGateSound(),
      vector: data ? { data, box: rabbitBox(box), glow: showsHoverLook(rabbit!.parentElement ?? rabbit!) } : null,
      button: captureButton(document.querySelector<HTMLElement>("[data-gate-enter]")),
      prompt: withBlinkPhase(freshPrompt(promptSprite.current) ?? capturePromptNow()),
    });
    setPhase("warp");
  }, []);

  const warpReveal = useCallback(() => {
    window.dispatchEvent(new Event("polutek:gate-enter"));
  }, []);
  const warpDone = useCallback(() => {
    hideGateFromNowOn();
    releaseGateSound();
    // The warp's canvases and paths (tens of MB of sprites on a desktop) are not needed any more.
    releaseGateVoid();
    releaseRabbitVector();
    focusMainWhenDone.current = true;
    setPhase("done");
  }, []);

  // Keyboard and screen-reader users land on the page content, not on a vanished button. Only after
  // the commit that lifts `inert` from the page: focusing inside an inert subtree does nothing (the
  // focus used to end up on <body>).
  useEffect(() => {
    if (phase !== "done" || !focusMainWhenDone.current) return;
    focusMainWhenDone.current = false;
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (shouldSkipGate()) return;
    if (!canWarp()) {
      setWarpAssetsReady(true);
      return;
    }
    let alive = true;
    void Promise.all([preloadGateSound(), preloadRabbitVector()]).then(() => {
      if (alive) setWarpAssetsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The press before the click (finger down, mouse down, key down) prepares the audio output, so the
  // click itself only has to start the sound and the first frame of the warp.
  useEffect(() => {
    if (phase !== "gate") return;
    const prime = () => primeGateSound();
    document.addEventListener("pointerdown", prime, { capture: true, passive: true });
    document.addEventListener("keydown", prime, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", prime, { capture: true });
      document.removeEventListener("keydown", prime, { capture: true });
    };
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
      focusMainWhenDone.current = true;
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
          warp={phase === "warp" && warpStart ? { start: warpStart, onReveal: warpReveal, onDone: warpDone } : null}
        />
      )}
    </PageRevealContext.Provider>
  );
}
