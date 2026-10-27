/**
 * The play / pause / replay family: one set of custom glyphs for the pill next to the track and the centre
 * overlay, in the site's soft language (rounded joins, no hard corners, nothing heavier than the line icons).
 * 24px box; the size on screen is set by CSS (`.mc-icon`: 20px in the pill, `.mc-hero-icon`: 28px).
 *
 *  - Play: a triangle whose corners are rounded by a round-joined stroke (corner radius = half the stroke).
 *    Its centroid sits exactly on the box centre (x = 12), so it reads as centred; the bounding box is shifted
 *    ~8% to the right, which is the optical correction for a triangle pointing right.
 *  - Pause: two bars with fully soft ends, symmetric about x = 12.
 *  - Replay: a 330 degree arc with a round-capped arrowhead, stroke 1.8 (the filled glyphs carry the weight).
 */
const BASE = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;

export function PlayGlyph({ className, testId }: { className?: string; testId?: string }) {
  return (
    <svg {...BASE} className={className} data-testid={testId}>
      <path
        d="M9.73 7.8 16.53 12 9.73 16.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={4.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PauseGlyph({ className, testId }: { className?: string; testId?: string }) {
  return (
    <svg {...BASE} className={className} data-testid={testId}>
      <rect x={7.4} y={5.7} width={3.6} height={12.6} rx={1.8} fill="currentColor" />
      <rect x={13} y={5.7} width={3.6} height={12.6} rx={1.8} fill="currentColor" />
    </svg>
  );
}

export function ReplayGlyph({ className, testId }: { className?: string; testId?: string }) {
  return (
    <svg
      {...BASE}
      className={className}
      data-testid={testId}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.9 8.6A7 7 0 1 1 5 12" />
      <path d="M5.2 4.6v4.4h4.4" />
    </svg>
  );
}

/**
 * Play and pause stacked in one box, cross-fading (opacity + a small scale) when `paused` flips; both stay in the
 * DOM so the swap is a 160ms transition rather than a remount (CSS: `.mc-glyph-swap`; off under reduced motion).
 */
export function PlayPauseGlyph({ paused, className }: { paused: boolean; className?: string }) {
  return (
    <span className="mc-glyph-swap" data-state={paused ? "paused" : "playing"} aria-hidden="true">
      <PlayGlyph className={className} testId="play-icon" />
      <PauseGlyph className={className} testId="pause-icon" />
    </span>
  );
}
