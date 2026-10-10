import styles from "./MatrixGatePrompt.module.css";

const PROMPT = "Follow the white rabbit";

export interface GatePromptLabels {
  /** Label of the progress bar while the page underneath is still loading. */
  loading: string;
  /** Caption under the rabbit once the page is ready; a click on rabbit or caption enters. */
  enter: string;
}

/**
 * The gate's prompt and entry. Two states, never both on screen, in one fixed-size slot under the
 * prompt (the prompt itself never moves):
 * - loading: a segmented progress bar labelled "ŁADOWANIE" where the rabbit will appear. There is no
 *   rabbit and no button yet, so nothing can be clicked before the page is ready;
 * - ready: the bar is replaced by the rabbit with "WEJDŹ" under it, one button: a click on the
 *   rabbit or on the caption is the pass.
 *
 * The bar is two overlapping fills (the longer one shows): a CSS-only time ease that is alive from
 * the server HTML on, and the real share of settled pieces reported by the gate. Plain markup
 * without timers, so the first painted frame is complete.
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
  const share = Math.min(1, Math.max(0, progress));
  return (
    <div className={styles.overlay}>
      <p className={styles.text}>
        {PROMPT}
        <span className={styles.cursor} aria-hidden="true" />
      </p>
      <div className={styles.slot}>
        {ready ? (
          <button
            type="button"
            className={styles.enter}
            data-gate-enter=""
            data-state="ready"
            onClick={onEnter}
            // The <head> boot script marks a click made before hydration (data-queued).
            suppressHydrationWarning
          >
            <img
              src="/rabbit-gate.webp"
              alt=""
              width={220}
              height={220}
              fetchPriority="high"
              decoding="async"
              className={styles.rabbitImg}
            />
            <span className={styles.caption}>{labels.enter}</span>
          </button>
        ) : (
          <div className={styles.progressWrap}>
            <div
              className={styles.progress}
              data-gate-progress=""
              role="progressbar"
              aria-label={labels.loading}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(share * 100)}
            >
              <span className={styles.progressLabel}>{labels.loading}</span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fillTime} />
                <span
                  className={styles.fillReal}
                  style={{ clipPath: `inset(0 ${100 - share * 100}% 0 0)` }}
                />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
