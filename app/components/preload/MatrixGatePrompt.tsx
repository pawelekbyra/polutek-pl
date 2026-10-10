import styles from "./MatrixGatePrompt.module.css";

const PROMPT = "Follow the white rabbit";

export interface GatePromptLabels {
  /** Caption while the page underneath is still loading. */
  loading: string;
  /** Caption once a click enters the page. */
  enter: string;
}

/**
 * The gate's prompt and entry button. Plain markup without timers: the text and the rabbit are
 * in the server HTML and visible from the first paint. While the page is not ready the button
 * shows a progress bar with "ŁADOWANIE" and a click is queued by the gate; once ready it is replaced
 * by "WEJDŹ" (only one of the two is ever shown).
 *
 * The bar is two overlapping fills (the longer one shows): a CSS-only time ease that is alive from
 * the server HTML on, and the real share of settled pieces reported by the gate.
 */
export function MatrixGatePrompt({
  ready,
  labels,
  progress = 0,
  onEnter,
}: {
  ready: boolean;
  labels: GatePromptLabels;
  /** Share (0..1) of the awaited pieces that have settled. */
  progress?: number;
  onEnter?: () => void;
}) {
  return (
    <div className={styles.overlay}>
      <p className={styles.text}>
        {PROMPT}
        <span className={styles.cursor} aria-hidden="true" />
      </p>
      <button
        type="button"
        className={styles.btn}
        data-gate-enter=""
        data-state={ready ? "ready" : "loading"}
        aria-disabled={ready ? undefined : true}
        onClick={onEnter}
        // The <head> boot script marks a click made before hydration (data-queued).
        suppressHydrationWarning
      >
        {/* Re-keyed so the new caption fades in instead of both ever being on screen. */}
        {ready ? (
          <span key="enter" className={styles.caption}>
            {labels.enter}
          </span>
        ) : (
          <span key="loading" className={styles.progress} data-gate-progress="">
            <span className={styles.progressLabel}>{labels.loading}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fillTime} />
              <span className={styles.fillReal} style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
            </span>
          </span>
        )}
        <img
          src="/rabbit-gate.webp"
          alt=""
          width={220}
          height={220}
          fetchPriority="high"
          decoding="async"
          className={styles.rabbitImg}
        />
      </button>
    </div>
  );
}
