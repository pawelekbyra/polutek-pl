import styles from "./MatrixGatePrompt.module.css";

const PROMPT = "Follow the white rabbit";

export interface GatePromptLabels {
  /** Label of the progress bar while the page underneath is still loading. */
  loading: string;
  /** Caption of the entry button, shown under the rabbit once the page is ready. */
  enter: string;
}

/**
 * The gate's prompt and entry, laid out around one fixed box (`.stage`, the rabbit's size) whose
 * centre is the centre of the visible viewport. The rabbit and "Follow the white rabbit" are there
 * from the first paint and never move; only the spot under the rabbit changes:
 * - loading: a thin progress bar labelled "ŁADOWANIE". Nothing can be clicked yet;
 * - ready: the "ENTER" button. A click on it, or on the rabbit, is the pass.
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
      <div className={styles.stage}>
        <p className={styles.text} data-gate-prompt="">
          {PROMPT}
          <span className={styles.cursor} aria-hidden="true" data-gate-cursor="" />
        </p>
        {/* The rabbit is part of the first paint; it is clickable only once the page is ready. */}
        <div
          className={styles.rabbit}
          data-gate-rabbit=""
          data-ready={ready ? "" : undefined}
          onClick={ready ? onEnter : undefined}
        >
          <img
            src="/rabbit-gate-2.svg"
            alt=""
            width={220}
            height={220}
            fetchPriority="high"
            decoding="async"
            draggable={false}
            className={styles.rabbitImg}
          />
        </div>
        {ready ? (
          <button
            type="button"
            className={styles.caption}
            data-gate-enter=""
            data-state="ready"
            onClick={onEnter}
          >
            {labels.enter}
          </button>
        ) : (
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
                style={{ clipPath: `inset(0 ${100 - share * 100}% 0 0 round 999px)` }}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
