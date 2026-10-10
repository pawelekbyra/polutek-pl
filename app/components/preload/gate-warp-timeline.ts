/**
 * Timeline of the entry warp (click on the rabbit / "ENTER"): pure numbers, no DOM, so it is unit
 * tested and shared by the renderer. Times are seconds from the click, aligned to the sound
 * `public/sounds/gate-enter.mp3` (docs/operations/PLAYER-SOUND.md):
 *
 * - 0.00 – 2.00  the sound swells: the camera zooms into the rabbit's eye (accelerating), the
 *                prompt and the caption fall away, the eye ends up filling the frame;
 * - 2.00 – 2.90  the low hit: the pupil pulses and widens until it swallows the screen (the hole);
 * - 2.25 – 4.95  out of the pupil a cylinder of code glyphs spirals towards the viewer, faster
 *                and denser all the time (the fall down the rabbit hole);
 * - 4.95         the bright hit: a light flash from the centre, the page is revealed under it
 *                and the hero starts with sound;
 * - 5.15 – 5.90  the gate fades out, the sound fades away (baked into the file).
 */

export const WARP = {
  zoomEnd: 2.0,
  pupilFadeIn: 1.0,
  burstStart: 2.0,
  burstEnd: 2.9,
  tunnelStart: 2.25,
  flash: 4.95,
  flashEnd: 5.15,
  end: 5.9,
} as const;

/** Where the pupil is in public/rabbit-gate.webp (440 x 440), as a share of the image edge. */
export const RABBIT_PUPIL = { x: 275 / 440, y: 183 / 440, r: 5 / 440 } as const;

/** Share of the frame's shorter edge the eye (about 11 pupil radii wide) fills at the end of the zoom. */
const EYE_FILL = 0.9;
const EYE_HALF_WIDTH_IN_PUPILS = 5.5;

export type Point = { x: number; y: number };

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInCubic = (t: number) => t * t * t;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Pupil centre and radius on screen (CSS px) for the rabbit image's bounding box. */
export function pupilOnScreen(box: { left: number; top: number; width: number; height: number }) {
  const edge = Math.min(box.width, box.height);
  // object-fit: contain inside a square box: the image is centred.
  const left = box.left + (box.width - edge) / 2;
  const top = box.top + (box.height - edge) / 2;
  return { x: left + RABBIT_PUPIL.x * edge, y: top + RABBIT_PUPIL.y * edge, r: RABBIT_PUPIL.r * edge };
}

/** The camera scale at which the eye fills the frame. */
export function maxZoom(pupilRadius: number, viewport: { width: number; height: number }): number {
  const eyeHalfWidth = Math.max(0.5, pupilRadius * EYE_HALF_WIDTH_IN_PUPILS);
  return Math.max(1, (Math.min(viewport.width, viewport.height) * EYE_FILL) / 2 / eyeHalfWidth);
}

export type Camera = {
  /** Uniform scale around the screen origin, then translation (CSS: translate(tx, ty) scale(s), origin 0 0). */
  scale: number;
  tx: number;
  ty: number;
  /** Rotation (radians) around the pupil during the swallow: the space is pulled in. */
  rotate: number;
  /** Opacity of the prompt and the caption (they fall away first). */
  textOpacity: number;
};

/**
 * Camera at time `t`: an accelerating zoom whose fixed point travels from the pupil to the screen
 * centre, so the eye ends centred and filling the frame; during the swallow it keeps pushing in
 * and twists a little.
 */
export function cameraAt(t: number, pupil: Point, center: Point, zoom: number): Camera {
  const p = easeInCubic(clamp01(t / WARP.zoomEnd));
  const pull = smoothstep(WARP.burstStart, WARP.burstEnd, t);
  // Log-space interpolation keeps the zoom speed perceptually even, then the swallow adds 1.8x.
  const scale = Math.exp(Math.log(zoom) * p) * (1 + 0.8 * pull);
  const target = { x: pupil.x + (center.x - pupil.x) * easeOutCubic(clamp01(t / WARP.zoomEnd)), y: pupil.y + (center.y - pupil.y) * easeOutCubic(clamp01(t / WARP.zoomEnd)) };
  return {
    scale,
    tx: target.x - scale * pupil.x,
    ty: target.y - scale * pupil.y,
    rotate: 0.26 * pull * pull,
    textOpacity: 1 - smoothstep(0, 0.7, t),
  };
}

/** Where the pupil is on screen at time `t` (follows the camera) and how large the hole is. */
export function pupilAt(t: number, pupil: Point & { r: number }, center: Point, zoom: number, cover: number) {
  const cam = cameraAt(t, pupil, center, zoom);
  const x = cam.tx + cam.scale * pupil.x;
  const y = cam.ty + cam.scale * pupil.y;
  const base = pupil.r * cam.scale;
  const u = clamp01((t - WARP.burstStart) / (WARP.burstEnd - WARP.burstStart));
  // Two pulses on the hit, then it opens wide (ease-in) until it covers the screen.
  const pulse = 1 + 0.35 * Math.sin(u * Math.PI * 4) * (1 - u);
  const r = u <= 0 ? base : (base + (cover - base) * easeInCubic(u)) * pulse;
  return { x, y, r, opacity: smoothstep(WARP.pupilFadeIn, WARP.pupilFadeIn + 0.5, t) };
}

/** Tunnel state at time `t`: how far the camera travelled (in rings), spin, density and brightness. */
export function tunnelAt(t: number) {
  const s = WARP.tunnelStart;
  const span = WARP.flash - s;
  const u = clamp01((t - s) / span);
  // Speed grows from 2 to 16 rings per second (quadratic), so the distance is its integral.
  const dt = Math.max(0, Math.min(t, WARP.flash) - s);
  const travel = 2 * dt + (14 * dt * dt * dt) / (3 * span * span) + Math.max(0, t - WARP.flash) * 16;
  return {
    visible: t >= s && t < WARP.flashEnd,
    travel,
    spin: 0.5 * dt + 2.2 * u * u * u,
    density: 0.45 + 0.55 * smoothstep(0, 0.8, u),
    intensity: smoothstep(s, s + 0.4, t),
  };
}

/** The flash: radius share (0..1 of the screen's half diagonal) and the gate's own opacity. */
export function flashAt(t: number) {
  return {
    radius: smoothstep(WARP.flash, WARP.flashEnd, t),
    screenOpacity: 1 - smoothstep(WARP.flashEnd, WARP.end, t),
  };
}
