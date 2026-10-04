import React from "react";
import { cn } from "@/lib/utils";
import { useOptionalLanguage } from "../LanguageContext";
import { MatrixRain } from "./MatrixRain";
import { MatrixGatePrompt, type GatePromptLabels } from "./MatrixGatePrompt";
import styles from "./SitePreloaderScreen.module.css";

const LABELS: Record<"pl" | "en", GatePromptLabels & { screen: string }> = {
  pl: { loading: "WCZYTUJĘ…", enter: "WEJDŹ", screen: "Wejście na stronę" },
  en: { loading: "LOADING…", enter: "ENTER", screen: "Site entrance" },
};

interface SitePreloaderScreenProps {
  /** Fades + blurs the screen out (the viewer entered). */
  leaving?: boolean;
  /** Auto-hides after 30 s even without JS — only while the page is still loading. */
  failsafe?: boolean;
  /** The page underneath is ready: the button enters instead of saying "loading". */
  ready?: boolean;
  /** Click on the entry button (queued by the gate while the page is not ready). */
  onEnter?: () => void;
}

/**
 * The entry gate of the public home page: Matrix rain, "Follow the white rabbit" and the rabbit
 * button, all present from the first paint. Rendered by the route-level `loading.tsx` (while the
 * server streams the page) and by `PageRevealGate`; both render identical markup, so the hand-over
 * is invisible.
 */
export function SitePreloaderScreen({
  leaving = false,
  failsafe = false,
  ready = false,
  onEnter,
}: SitePreloaderScreenProps) {
  const labels = LABELS[useOptionalLanguage() === "pl" ? "pl" : "en"];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.screen}
      aria-hidden={leaving || undefined}
      data-testid="site-preloader"
      data-site-preloader=""
      data-state={leaving ? "leaving" : ready ? "gate" : "covering"}
      // The carrot cursor belongs to the gate only; it goes away with the screen.
      data-cursor={leaving ? undefined : "carrot"}
      className={cn(styles.screen, failsafe && styles.failsafe, leaving && styles.leaving)}
    >
      <MatrixRain />
      <MatrixGatePrompt ready={ready} labels={labels} onEnter={onEnter} />
    </div>
  );
}
