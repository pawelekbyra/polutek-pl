/**
 * Timeline of the entry warp (click on the rabbit / "ENTER"): pure numbers, no DOM, so it is unit
 * tested and shared by the renderer. Times are seconds from the click, aligned to the sound
 * `public/sounds/gate-enter-12s.mp3` (docs/operations/PLAYER-SOUND.md):
 *
 * - 0.00 – 0.65  the sound opens with a whisper ("here come…"); the camera holds still, only the
 *                prompt fades (the click visibly registered);
 * - 0.65 – 4.95  from the main motif on (bass enters at 0.65 s, measured), one continuous zoom into the
 *                rabbit's eye and on into the black pixel of its pupil: it moves from its very first
 *                frame but slowly, and speeds up all the way, so it enters the pupil exactly on the
 *                sound's first bright hit (4.95 s);
 * - 4.55 – 4.95  the last moments of the zoom are made fully black (the upscaled pixel edge is soft);
 * - 4.95 – 11.30 THE VOID: the screen is black while the rest of the sound plays (about 6.4 s). It is
 *                kept empty on purpose, so an animation can be built there later (gate-void.ts is
 *                its hook); until then it is simply black;
 * - 11.30        the final, loudest hit of the sound: a light flash from the centre;
 * - 11.50        the flash covers the screen: the page shows through as the gate fades out, and the
 *                hero video starts FROM ITS BEGINNING (it waited paused at 0 since the click);
 * - 11.50 – 12.30 the gate fades out, the sound fades away (baked into the file, 12.3 s long).
 */

export const WARP = {
  /** End of the whisper at the start of the sound: the main motif (and the zoom) start here. */
  zoomFrom: 0.65,
  /** The sound's first bright hit: the zoom is inside the pupil, the screen black. */
  blackAt: 4.95,
  blackFrom: 4.55,
  /** The sound's final hit (measured at 11.3 s); the flash is aligned to it. */
  flash: 11.3,
  /** Flash complete: the hero starts from its beginning here. */
  flashEnd: 11.5,
  /** Length of public/sounds/gate-enter-12s.mp3. */
  end: 12.3,
} as const;

/** How hard the zoom accelerates (log-space exponential): higher = slower start, faster end. */
const ZOOM_ACCEL = 2.2;
/** Seconds after the zoom starts by which the pupil has travelled to the screen centre. */
const CENTRE_BY = 3.0;

/**
 * The black core of the pupil in public/rabbit-gate.webp / .svg (440 x 440; the vector keeps the same proportions), as a share of the image edge:
 * its centre and the radius that is still solid black.
 */
export const RABBIT_PUPIL = { x: 275.5 / 440, y: 183.5 / 440, core: 2.8 / 440 } as const;

/** Share of the frame's shorter edge the eye fills (used for the eye-filling zoom level). */
const EYE_FILL = 0.9;
const EYE_HALF_WIDTH_IN_CORES = 9;

export type Point = { x: number; y: number };

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** The square the drawing occupies inside the image's bounding box (object-fit: contain, centred). */
export function rabbitBox(box: { left: number; top: number; width: number; height: number }) {
  const edge = Math.min(box.width, box.height);
  return { left: box.left + (box.width - edge) / 2, top: box.top + (box.height - edge) / 2, edge };
}

/** The pupil's black core on screen (CSS px) for the rabbit image's bounding box. */
export function pupilOnScreen(box: { left: number; top: number; width: number; height: number }) {
  const sq = rabbitBox(box);
  return { x: sq.left + RABBIT_PUPIL.x * sq.edge, y: sq.top + RABBIT_PUPIL.y * sq.edge, r: RABBIT_PUPIL.core * sq.edge };
}

/** Camera scales: the eye filling the frame, and the black core covering the whole screen. */
export function zoomLevels(coreRadius: number, viewport: { width: number; height: number }) {
  const r = Math.max(0.25, coreRadius);
  const eye = Math.max(1, (Math.min(viewport.width, viewport.height) * EYE_FILL) / 2 / (r * EYE_HALF_WIDTH_IN_CORES));
  // The core must cover the half diagonal, with a margin for the soft (upscaled) edge.
  const black = Math.max(eye * 2, (Math.hypot(viewport.width, viewport.height) / 2 / r) * 1.4);
  return { eye, black };
}

export type Camera = {
  /** CSS: translate(tx, ty) scale(scale), transform-origin 0 0. */
  scale: number;
  tx: number;
  ty: number;
  /** Opacity of the prompt and the caption (they fall away first). */
  textOpacity: number;
};

/**
 * Camera at time `t`: still until the whisper is over (`zoomFrom`), then one zoom from rest to inside
 * the pupil's black core (`blackAt`), exponential in log space: it visibly moves from its first frame,
 * stays slow while the whole rabbit is in view and accelerates into the eye, so the speed always feels
 * like a fall. The zoom's fixed point travels to the screen centre in its first `CENTRE_BY` s.
 */
export function cameraAt(t: number, pupil: Point, center: Point, zoom: { eye: number; black: number }): Camera {
  const u = clamp01((t - WARP.zoomFrom) / (WARP.blackAt - WARP.zoomFrom));
  const progress = (Math.exp(ZOOM_ACCEL * u) - 1) / (Math.exp(ZOOM_ACCEL) - 1);
  const scale = Math.exp(Math.log(zoom.black) * progress);
  const move = easeOutCubic(clamp01((t - WARP.zoomFrom) / CENTRE_BY));
  const target = { x: pupil.x + (center.x - pupil.x) * move, y: pupil.y + (center.y - pupil.y) * move };
  return {
    scale,
    tx: target.x - scale * pupil.x,
    ty: target.y - scale * pupil.y,
    textOpacity: 1 - smoothstep(0, 0.7, t),
  };
}

/** Black over everything while the zoom ends inside the pupil (no grey edge of the upscaled pixel). */
export function blackoutAt(t: number): number {
  return t >= WARP.flashEnd ? 0 : smoothstep(WARP.blackFrom, WARP.blackAt, t);
}

/** The flash: radius share (0..1 of the screen's half diagonal) and the gate's own opacity. */
export function flashAt(t: number) {
  return {
    radius: smoothstep(WARP.flash, WARP.flashEnd, t),
    screenOpacity: 1 - smoothstep(WARP.flashEnd, WARP.end, t),
  };
}
