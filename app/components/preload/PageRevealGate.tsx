"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { SitePreloaderScreen } from "./SitePreloaderScreen";
import { useOptionalLanguage } from "../LanguageContext";

/**
 * Coordinated first reveal of the public home page.
 *
 * Without this, every independently-loading piece (auth-dependent navbar, player
 * access check, poster, comments) popped in on its own schedule — the "popcorn"
 * effect. The gate keeps one calm preloader screen on top of the page until the
 * pieces the viewer sees first have settled, then fades the whole page in at once.
 *
 * It never blocks for long: the preloader leaves after {@link PAGE_REVEAL_MAX_WAIT_MS}
 * from navigation start whatever is still pending, and CSS hides it after a few
 * seconds even if JS never runs. There is no click — this is not a splash/ENTER
 * gate (see CLAUDE.md §4.13).
 */

type PageRevealContextValue = {
  reportReady: (key: string) => void;
};

const PageRevealContext = createContext<PageRevealContextValue | null>(null);

/**
 * Upper bound on how long the preloader may hold the page, measured from navigation start.
 * Long enough for the featured video's stream to buffer its first frames on a normal
 * connection (the player is one of the awaited pieces), short enough not to feel stuck.
 */
export const PAGE_REVEAL_MAX_WAIT_MS = 3000;
/** On a late mount (e.g. hydration was slow) still give the page this long to settle. */
export const PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS = 700;
const LEAVE_ANIMATION_MS = 420;

// Once the page has been revealed in this document, later mounts (client-side
// navigation back to the home page) skip the preloader: the app is already warm.
// Only ever written in effects, so server rendering never sees it.
let revealedInThisDocument = false;

/**
 * Whether the first-load preloader has already been shown and lifted in this
 * document. Client navigations use it to skip the full-screen preloader.
 */
export function hasRevealedPageInThisDocument(): boolean {
  return revealedInThisDocument;
}

/** @internal test helper */
export function resetPageRevealForTests() {
  revealedInThisDocument = false;
}

/**
 * Report that a piece of the page the gate waits for (see `waitFor`) has settled.
 * No-op outside a {@link PageRevealGate}, or when `key` is empty.
 */
export function usePageRevealReady(key: string | undefined, ready: boolean) {
  const context = useContext(PageRevealContext);
  useEffect(() => {
    if (key && ready) context?.reportReady(key);
  }, [context, key, ready]);
}

function useDecodedImage(src: string | null | undefined, onDone: () => void) {
  useEffect(() => {
    if (!src) {
      onDone();
      return;
    }
    let cancelled = false;
    const finish = () => {
      if (!cancelled) onDone();
    };
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    if (typeof img.decode === "function") {
      img.decode().then(finish, finish);
    } else {
      img.onload = finish;
      img.onerror = finish;
    }
    return () => {
      cancelled = true;
    };
  }, [src, onDone]);
}

interface PageRevealGateProps {
  children: React.ReactNode;
  /** Keys reported via {@link usePageRevealReady} that must settle before the reveal. */
  waitFor?: string[];
  /** Poster of the featured video — decoded before the reveal so it paints at once. */
  posterUrl?: string | null;
}

export function PageRevealGate({ children, waitFor = [], posterUrl }: PageRevealGateProps) {
  const { isLoaded: authLoaded } = useAuth();
  const language = useOptionalLanguage();
  // Decided once per mount: a later mount in the same document starts revealed.
  const [done, setDone] = useState(() => revealedInThisDocument);
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
  const markPosterReady = useCallback(() => reportReady("poster"), [reportReady]);

  const waitForKey = waitFor.join("|");
  const allReady =
    authLoaded &&
    readyKeys.has("poster") &&
    waitForKey.split("|").every((key) => !key || readyKeys.has(key));
  const leaving = !done && (allReady || timedOut);
  const covering = !done && !leaving;

  useDecodedImage(covering ? posterUrl : null, markPosterReady);

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

  useEffect(() => {
    if (!leaving) return;
    revealedInThisDocument = true;
    const timer = window.setTimeout(() => setDone(true), LEAVE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const contextValue = useMemo(() => ({ reportReady }), [reportReady]);

  return (
    <PageRevealContext.Provider value={contextValue}>
      {children}
      {!done && (
        <SitePreloaderScreen
          leaving={leaving}
          failsafe
          label={language === "pl" ? "Ładowanie strony…" : "Loading…"}
        />
      )}
    </PageRevealContext.Provider>
  );
}
