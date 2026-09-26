import React from "react";
import { cn } from "@/lib/utils";
import styles from "./SitePreloaderScreen.module.css";

interface SitePreloaderScreenProps {
  /** Fades the screen out (the page underneath is ready). */
  leaving?: boolean;
  /** Auto-hides after a few seconds even without JS — only for the reveal gate. */
  failsafe?: boolean;
  label?: string;
}

/**
 * The one full-screen loading view of the public home page. Rendered both by the
 * route-level `loading.tsx` (while the server streams the page) and by
 * `PageRevealGate` (while the page's client-side pieces settle), so the two
 * phases look like one continuous screen instead of a skeleton that swaps into a
 * different skeleton. No hooks — safe in server components.
 */
export function SitePreloaderScreen({
  leaving = false,
  failsafe = false,
  label = "Loading…",
}: SitePreloaderScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      aria-hidden={leaving || undefined}
      data-testid="site-preloader"
      data-state={leaving ? "leaving" : "covering"}
      className={cn(styles.screen, failsafe && styles.failsafe, leaving && styles.leaving)}
    >
      <div className={styles.inner}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static local vector, same as BrandName */}
        <img src="/logo-glasses.svg" alt="" className={styles.logo} />
        <div className={styles.track} aria-hidden="true">
          <span className={styles.bar} />
        </div>
      </div>
    </div>
  );
}
