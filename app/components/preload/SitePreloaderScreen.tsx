import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { MatrixRain } from "./MatrixRain";
import { MatrixGatePrompt, type GatePromptLabels } from "./MatrixGatePrompt";
import { GateWarp, type WarpStart } from "./GateWarp";
import styles from "./SitePreloaderScreen.module.css";

interface SitePreloaderScreenProps {
  /** Fades + blurs the screen out (the viewer entered). */
  leaving?: boolean;
  /** Auto-hides after 30 s even without JS — only while the page is still loading. */
  failsafe?: boolean;
  /** The page underneath is ready: the button enters instead of the progress bar. */
  ready?: boolean;
  /** Share (0..1) of the awaited pieces that have settled (drives the progress bar). */
  progress?: number;
  /** Click on the rabbit or the "ENTER" caption (they exist only once the page is ready). */
  onEnter?: () => void;
  /** The entry warp is running (zoom into the eye, tunnel, flash); see GateWarp. */
  warp?: { start: WarpStart; onReveal: () => void; onDone: () => void } | null;
}

/**
 * The entry gate of the public home page: Matrix rain and a progress bar from the first paint; once
 * the page is ready the bar gives way to the rabbit, with "Follow the white rabbit" above it and
 * "ENTER" under it. Rendered by the route-level `loading.tsx` (while the server streams the page)
 * and by `PageRevealGate`; both render identical markup, so the hand-over is invisible.
 */
export function SitePreloaderScreen({
  leaving = false,
  failsafe = false,
  ready = false,
  progress = 0,
  onEnter,
  warp = null,
}: SitePreloaderScreenProps) {
  // Elements the warp animates directly (callback refs: they exist from the first commit).
  const [screenEl, setScreenEl] = useState<HTMLDivElement | null>(null);
  const [cameraEl, setCameraEl] = useState<HTMLDivElement | null>(null);
  const tx = useOptionalTx();
  const labels = {
    loading: tx("ŁADOWANIE", "LOADING"),
    // The entry caption is the same word in every language (owner decision 2026-10-10), so it is not translated.
    enter: "ENTER",
    screen: tx("Wejście na stronę", "Site entrance"),
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.screen}
      aria-hidden={leaving || warp ? true : undefined}
      data-testid="site-preloader"
      data-site-preloader=""
      data-state={leaving ? "leaving" : warp ? "warp" : ready ? "gate" : "covering"}
      // The player leaves gestures on the gate alone (no unmuting the hidden hero behind it).
      data-sound-control=""
      // The pointer: the carrot while loading and once ENTER can be clicked (the attribute does not depend
      // on `ready` for that, so the server-rendered first paint already has it), none at all from the click
      // to the end of the entry animation.
      data-cursor={!leaving && !warp ? "carrot" : "none"}
      ref={setScreenEl}
      className={cn(styles.screen, failsafe && styles.failsafe, leaving && styles.leaving)}
    >
      <div ref={setCameraEl} data-gate-camera="" className={styles.camera}>
        <MatrixRain />
        <MatrixGatePrompt ready={ready} labels={labels} progress={progress} onEnter={warp ? undefined : onEnter} />
      </div>
      {warp && <GateWarp start={warp.start} camera={cameraEl} screen={screenEl} onReveal={warp.onReveal} onDone={warp.onDone} />}
    </div>
  );
}
