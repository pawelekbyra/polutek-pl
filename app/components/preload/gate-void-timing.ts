/**
 * The void's clock and shared maths: key moments (VOID_T), the title's flight (titleScale, revealAt),
 * the tunnel's build front and the camera's travel. Pure functions of `t` (seconds on the sound's
 * clock), no canvas, so tests and every drawing module can use them.
 */
import { zoomProgress } from "./gate-warp-timeline";

export const VOID_TITLE = "WWW.PAWELPERFECT.COM";

/**
 * Candidates for the final dive: the two letters in the middle of the title ("P" and "E" of
 * "PERFECT"). Aiming at the gap between letters filled the screen with black right before the white
 * flash; the dive goes into the thickest point of whichever of these lies nearest the title's centre
 * (chosen from the rendered glyphs), so the camera hardly has to move sideways.
 */
export const AIM_CANDIDATES = [VOID_TITLE.length / 2 - 1, VOID_TITLE.length / 2] as const;

/** Key moments (seconds since the click). */
export const VOID_T = {
  /** The camera starts travelling down the tunnel (it is shown only from the entry, tunnelFull). */
  tunnelFrom: 4.25,
  /**
   * The pupil fills the screen and the camera enters it (= WARP.blackAt): the tunnel is building
   * itself out of the distance (from 0.08 s before, when the pupil has covered the screen).
   */
  tunnelFull: 4.95,
  open: 5.15,
  /** The letters stay cycling rain glyphs for the whole flight and decode once the title is in place. */
  decodeFrom: 8.4,
  decodeStep: 0.05,
  arrive: 8.4,
  swell: 8.5,
  push: 10.2,
  flash: 11.3,
} as const;

const FAR = 30; // starting distance of the title (1 = resting distance)
/**
 * Camera speed in world units per second, constant. Rings at depth 2 grow at about the zoom's mean
 * rate into the rabbit (~1.35 e-folds per second), so the tunnel keeps the zoom's tempo.
 */
export const TUNNEL_SPEED = 2.8;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Deterministic 0..1 noise for glyph choices and dust placement. */
export function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The title's scale at time t (1 = resting size): flies in from FAR, rests, then rushes past. */
export function titleScale(t: number): number {
  if (t < VOID_T.open) return 0;
  if (t < VOID_T.arrive) {
    const a = clamp01((t - VOID_T.open) / (VOID_T.arrive - VOID_T.open));
    // Distance falls quickly at first and brakes at the end (ease-out), apparent size = 1 / distance.
    const z = 1 + (FAR - 1) * (1 - a) * (1 - a) * (1 - a);
    return 1 / z;
  }
  if (t < VOID_T.push) return 1 + 0.06 * ((t - VOID_T.arrive) / (VOID_T.push - VOID_T.arrive));
  // Not clamped at the flash: the title keeps flying at the camera until the flash has covered the
  // screen (it goes through the camera, it never stops at a "full size"). Inside the flash it bolts:
  // the zoom rate jumps and keeps accelerating, about 20x closer in those last 0.2 s.
  const p = Math.min(1, (t - VOID_T.push) / (VOID_T.flash - VOID_T.push));
  const rush = 1.06 * Math.exp(Math.log(9) * p * p * p);
  const d = Math.max(0, t - VOID_T.flash);
  return rush * Math.exp(6 * d + 45 * d * d);
}

/** When letter `i` resolves from cycling glyphs into its real character. */
export function revealAt(i: number): number {
  return VOID_T.decodeFrom + i * VOID_T.decodeStep + (hash(i, 3) - 0.5) * 0.03;
}

/** Visible viewport in CSS px. */
export type Size = { width: number; height: number };

const LN_ZOOM = 6; // ln of the zoom's whole scale range (zoomLevels: about 6.1 on a phone, 6.5 on a desktop)
/** The zoom's tempo when it enters the pupil, in e-folds per second. */
export function zoomEndRate(): number {
  const dt = 0.001;
  return (LN_ZOOM * (zoomProgress(VOID_T.tunnelFull) - zoomProgress(VOID_T.tunnelFull - dt))) / dt;
}

/** When the tunnel starts building: the pupil has just covered the whole screen. */
const BUILD_FROM = VOID_T.tunnelFull - 0.08;
/**
 * Where the front starts: deep, but nearer than the fog (from FOG_DEPTH * 0.7 on), so the tunnel is
 * visible from the very moment the pupil covers the screen; starting at the tube's far end, inside the
 * fog, it showed only about 0.2 s later.
 */
const BUILD_DEPTH = 11;
/**
 * The tunnel builds itself out of the distance: only the rings beyond this depth exist. The front
 * starts deep in the tube (BUILD_DEPTH) the moment the pupil covers the screen and flies
 * towards the viewer, so the first glyphs come at the screen and the tube forms behind them. Its
 * depth falls exponentially at the zoom's own end tempo (its ring grows on screen exactly as fast as
 * the zoom did), so the fall into the pupil flows straight on into it; it reaches the screen edges
 * about 0.8 s later. Infinity: nothing yet; 0: the whole tube is built.
 */
export function tunnelFront(t: number): number {
  if (t < BUILD_FROM) return Number.POSITIVE_INFINITY;
  const z = BUILD_DEPTH * Math.exp(-zoomEndRate() * (t - BUILD_FROM));
  return z <= 0.9 ? 0 : z;
}

/**
 * How far the camera has travelled down the tube: one constant speed from the start (no burst, no
 * slowing while the title rests); only inside the flash, when the screen is turning white, it bolts.
 */
export function tunnelTravel(t: number): number {
  if (t <= VOID_T.tunnelFrom) return 0;
  const bolt = Math.max(0, t - VOID_T.flash);
  return TUNNEL_SPEED * (t - VOID_T.tunnelFrom) + 120 * bolt * bolt;
}
