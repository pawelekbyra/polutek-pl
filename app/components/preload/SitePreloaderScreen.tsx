import React from "react";
import { cn } from "@/lib/utils";
import { MatrixRain } from "./MatrixRain";
import { MatrixGatePrompt } from "./MatrixGatePrompt";
import styles from "./SitePreloaderScreen.module.css";

interface SitePreloaderScreenProps {
  /** Fades + blurs the screen out (the page underneath is ready). */
  leaving?: boolean;
  /** Auto-hides after a few seconds even without JS — only for the reveal gate. */
  failsafe?: boolean;
  label?: string;
  /** When true shows the "Follow the white rabbit" prompt over the rain. */
  showGate?: boolean;
  /** Called when the user clicks the rabbit button. */
  onGateClick?: () => void;
}

/**
 * The one full-screen loading view of the public home page. Rendered both by the
 * route-level `loading.tsx` (while the server streams the page) and by
 * `PageRevealGate` (while the page's client-side pieces settle).
 */
export function SitePreloaderScreen({
  leaving = false,
  failsafe = false,
  label = "Loading…",
  showGate = false,
  onGateClick,
}: SitePreloaderScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      aria-hidden={leaving || undefined}
      data-testid="site-preloader"
      data-state={leaving ? "leaving" : showGate ? "gate" : "covering"}
      className={cn(styles.screen, failsafe && styles.failsafe, leaving && styles.leaving)}
    >
      <MatrixRain />
      {showGate && onGateClick && <MatrixGatePrompt onEnter={onGateClick} />}
    </div>
  );
}
