/**
 * Timeline of the entry warp (click on the rabbit / "ENTER"): pure numbers, no DOM, so it is unit
 * tested and shared by the renderer. Times are seconds from the click, aligned to the sound
 * `public/sounds/gate-enter-12s.mp3` (docs/operations/PLAYER-SOUND.md):
 *
 * - 0.00 – 2.00  the sound swells: the camera zooms into the rabbit's eye (accelerating), the
 *                prompt and the caption fall away, the eye ends up filling the frame;
 * - 2.00 – 4.40  from the low hit on, the zoom goes on into the black pixel of the pupil in the
 *                picture until the whole screen is black (the last moments are made fully black);
 * - 4.40 – 11.30 THE VOID: the screen is black while the rest of the sound plays (about 6.9 s). It is
 *                kept empty on purpose, so an animation can be built there later (gate-void.ts is
 *                its hook); until then it is simply black;
 * - 11.30        the final, loudest hit of the sound: a light flash from the centre, the page is
 *                revealed under it and the hero starts with sound;
 * - 11.50 – 12.30 the gate fades out, the sound fades away (baked into the file, 12.3 s long).
 */

export const WARP = {
  eyeAt: 2.0,
  blackFrom: 4.0,
  blackAt: 4.4,
  /** The sound's final hit (measured at 11.3 s); the flash is aligned to it. */
  flash: 11.3,
  flashEnd: 11.5,
  /** Length of public/sounds/gate-enter-12s.mp3. */
  end: 12.3,
} as const;

/**
 * The black core of the pupil in public/rabbit-gate.webp / .svg (440 x 440; the vector keeps the same proportions), as a share of the image edge:
 * its centre and the radius that is still solid black.
 */
export const RABBIT_PUPIL = { x: 275.5 / 440, y: 183.5 / 440, core: 2.8 / 440 } as const;

/** Share of the frame's shorter edge the eye (about 11 core radii either side) fills at `eyeAt`. */
const EYE_FILL = 0.9;
const EYE_HALF_WIDTH_IN_CORES = 9;

export type Point = { x: number; y: number };

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInCubic = (t: number) => t * t * t;
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
 * Camera at time `t`: an accelerating zoom whose fixed point travels from the pupil to the screen
 * centre (eye centred and filling the frame at `eyeAt`), then on into the pupil's black core until
 * it covers the screen at `blackAt`. Interpolated in log space, so the speed feels even.
 */
export function cameraAt(t: number, pupil: Point, center: Point, zoom: { eye: number; black: number }): Camera {
  const first = clamp01(t / WARP.eyeAt);
  const second = smoothstep(WARP.eyeAt, WARP.blackAt, t);
  const logScale = Math.log(zoom.eye) * easeInCubic(first) + (Math.log(zoom.black) - Math.log(zoom.eye)) * second;
  const scale = Math.exp(logScale);
  const move = easeOutCubic(first);
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
