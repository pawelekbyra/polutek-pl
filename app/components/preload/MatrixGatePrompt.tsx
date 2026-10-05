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
 * says so ("WCZYTUJĘ…") and a click is queued by the gate; once ready the caption is replaced by
 * "WEJDŹ" (only one of the two is ever shown).
 */
export function MatrixGatePrompt({
  ready,
  labels,
  onEnter,
}: {
  ready: boolean;
  labels: GatePromptLabels;
  onEnter?: () => void;
}) {
  const caption = ready ? labels.enter : labels.loading;
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
        <span key={caption} className={styles.caption}>
          {caption}
        </span>
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
