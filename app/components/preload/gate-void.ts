/**
 * THE VOID: the black screen inside the pupil, between the end of the zoom (WARP.blackAt, 4.95 s)
 * and the final flash (WARP.flash, 11.3 s). Timed to the entry sound (gate-warp-timeline.ts):
 *
 * - 5.15        a point of light opens in the depth of the pupil; a fine dust of rain glyphs starts
 *               to stream out of it towards the viewer;
 * - 5.15 – 8.40 "WWW.PAWELPERFECT.COM" (one line) flies out of that depth and brakes to a stop in
 *               front of the viewer (perspective: its distance falls fast, then eases out); while it
 *               comes, its letters decode one by one from cycling Matrix glyphs, each with a flare;
 * - 8.50        the sound swells: a glow pulse runs through the resolved title;
 * - 8.40 – 10.2 it hangs there, drifting slowly closer (the sound's quiet stretch);
 * - 10.2 – 11.5 the sound rises to its last hit: the title accelerates towards the viewer and flies
 *               through the camera; inside the flash (11.3 – 11.5 s) it bolts, about 20x closer in
 *               0.2 s, until the screen is white; the dust bolts with it.
 *
 * Built for phones: nothing is blurred per frame. The glow of each letter and the light in the depth
 * are pre-rendered once into small sprites and only copied (scaled) every frame; the crisp letters
 * and the dust are plain text with one font per frame and a transform per glyph. Everything is a
 * function of `t` (deterministic glyph choices), so it follows the sound's clock and can be skipped
 * into at any moment. Light on black, the site's own page colour. Canvas units are CSS px (the
 * context arrives scaled by the device pixel ratio).
 */
import { RAIN_CONFIG } from "./matrix-rain-engine";

export const VOID_TITLE = "WWW.PAWELPERFECT.COM";

/** Key moments (seconds since the click). */
export const VOID_T = {
  open: 5.15,
  decodeFrom: 6.25,
  decodeStep: 0.085,
  arrive: 8.4,
  swell: 8.5,
  push: 10.2,
  flash: 11.3,
} as const;

const LIGHT = "247, 249, 252";
const TRACKING = 0.12; // letter spacing, in em
const FAR = 30; // starting distance of the title (1 = resting distance)
const DUST = 54;
/** Matrix glyphs used by the dust and by the title's undecoded letters (pre-rendered once). */
const RAIN_GLYPHS = 24;
const GLYPH_PX = 40;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Deterministic 0..1 noise for glyph choices and dust placement. */
function hash(a: number, b: number): number {
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
  return VOID_T.decodeFrom + i * VOID_T.decodeStep + (hash(i, 3) - 0.5) * 0.06;
}

let family: string | null = null;
function monoFamily(): string {
  if (family) return family;
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  family = `${v ? `${v}, ` : ""}ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  return family;
}

/** Font size (px) at which the resting title (one line) spans most of the screen width. */
function restingFontSize(ctx: CanvasRenderingContext2D, width: number): number {
  ctx.font = `700 100px ${monoFamily()}`;
  let w = 0;
  for (const ch of VOID_TITLE) w += ctx.measureText(ch).width;
  w += (VOID_TITLE.length - 1) * TRACKING * 100;
  const target = Math.min(width * 0.86, 980);
  return Math.max(12, Math.min(64, (100 * target) / w));
}

/** The resting layout (font size, glyph widths) for a viewport width; measured once per width. */
let layout: { width: number; restPx: number; widths: number[]; total: number } | null = null;
function titleLayout(ctx: CanvasRenderingContext2D, width: number) {
  if (layout && layout.width === width) return layout;
  const restPx = restingFontSize(ctx, width);
  ctx.font = `700 ${restPx}px ${monoFamily()}`;
  const widths = [...VOID_TITLE].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + TRACKING * restPx * (VOID_TITLE.length - 1);
  layout = { width, restPx, widths, total };
  return layout;
}

// --- Sprites: rendered once, copied every frame -----------------------------------------------

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

let lightSprite: HTMLCanvasElement | null = null;
/** A soft white disc (light from the depth), 256 px, drawn scaled. */
function getLightSprite(): HTMLCanvasElement | null {
  if (lightSprite) return lightSprite;
  const c = makeCanvas(256, 256);
  const g = c?.getContext("2d");
  if (!c || !g) return null;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, `rgba(${LIGHT}, 1)`);
  grad.addColorStop(0.35, `rgba(${LIGHT}, 0.45)`);
  grad.addColorStop(1, `rgba(${LIGHT}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  lightSprite = c;
  return c;
}

/**
 * A small atlas of rain glyphs, white, rendered once: drawing these (Japanese) glyphs as text every
 * frame goes through font fallback and was the costliest part of the void on phones.
 */
let rainAtlas: HTMLCanvasElement[] | null = null;
function getRainAtlas(): HTMLCanvasElement[] | null {
  if (rainAtlas) return rainAtlas;
  const chars = RAIN_CONFIG.chars;
  const atlas: HTMLCanvasElement[] = [];
  for (let i = 0; i < RAIN_GLYPHS; i++) {
    const c = makeCanvas(GLYPH_PX * 1.2, GLYPH_PX * 1.2);
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    g.font = `${GLYPH_PX}px monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = `rgb(${LIGHT})`;
    g.fillText(chars.charAt(Math.floor(hash(i, 97) * chars.length)), c.width / 2, c.height / 2);
    atlas.push(c);
  }
  rainAtlas = atlas;
  return atlas;
}

/** The title's letters themselves (sharp, no glow) at about the device resolution of their resting size. */
type LetterSprites = { refPx: number; byChar: Map<string, HTMLCanvasElement> };
let letters: LetterSprites | null = null;
function getLetterSprites(refPx: number): LetterSprites | null {
  if (letters && letters.refPx === refPx) return letters;
  const byChar = new Map<string, HTMLCanvasElement>();
  for (const ch of new Set(VOID_TITLE)) {
    const c = makeCanvas(refPx * 1.1, refPx * 1.4);
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    g.font = `700 ${refPx}px ${monoFamily()}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = `rgb(${LIGHT})`;
    g.fillText(ch, c.width / 2, c.height / 2);
    byChar.set(ch, c);
  }
  letters = { refPx, byChar };
  return letters;
}

/** Glow halos of the title's letters (one per distinct letter), rendered with a blur once. */
type GlowSprites = { refPx: number; pad: number; byChar: Map<string, HTMLCanvasElement> };
let glow: GlowSprites | null = null;
function getGlowSprites(refPx: number): GlowSprites | null {
  if (glow && Math.abs(glow.refPx - refPx) < 0.5) return glow;
  const pad = Math.ceil(refPx * 0.9);
  const byChar = new Map<string, HTMLCanvasElement>();
  for (const ch of new Set(VOID_TITLE)) {
    const c = makeCanvas(refPx + pad * 2, refPx * 1.4 + pad * 2);
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    g.font = `700 ${refPx}px ${monoFamily()}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = `rgba(${LIGHT}, 1)`;
    g.shadowBlur = refPx * 0.55;
    g.fillStyle = `rgba(${LIGHT}, 0.9)`;
    g.fillText(ch, c.width / 2, c.height / 2);
    byChar.set(ch, c);
  }
  glow = { refPx, pad, byChar };
  return glow;
}

// --- Layers ---------------------------------------------------------------------------------------

type Size = { width: number; height: number };

function drawDepthLight(ctx: CanvasRenderingContext2D, size: Size, t: number) {
  const open = smooth(VOID_T.open, VOID_T.open + 0.8, t) * (1 - 0.6 * smooth(VOID_T.arrive - 0.6, VOID_T.arrive + 0.4, t));
  const rush = smooth(VOID_T.push, VOID_T.flash, t);
  const strength = 0.16 * open + 0.22 * rush;
  const sprite = getLightSprite();
  if (strength < 0.005 || !sprite) return;
  const radius = Math.min(size.width, size.height) * (0.18 + 0.5 * rush);
  ctx.globalAlpha = strength;
  ctx.drawImage(sprite, size.width / 2 - radius, size.height / 2 - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function drawDust(ctx: CanvasRenderingContext2D, base: DOMMatrix, size: Size, t: number) {
  const atlas = getRainAtlas();
  if (!atlas) return;
  const cx = size.width / 2;
  const cy = size.height / 2;
  const reach = Math.hypot(size.width, size.height) * 0.62;
  const fadeIn = smooth(VOID_T.open, VOID_T.open + 1.2, t);
  // Quiet while the title rests, fast when it rushes out.
  const speed =
    0.45 + 0.25 * smooth(VOID_T.open, VOID_T.arrive, t) + 1.6 * smooth(VOID_T.push, VOID_T.flash, t) + 4 * smooth(VOID_T.flash, VOID_T.flash + 0.2, t);
  for (let i = 0; i < DUST; i++) {
    const angle = hash(i, 11) * Math.PI * 2;
    // Each speck cycles from the depth (cycle 0) to the viewer (cycle 1), offset per speck.
    const cycle = ((t - VOID_T.open) * speed * (0.6 + hash(i, 5) * 0.8) + hash(i, 7)) % 1;
    const alpha = fadeIn * 0.45 * smooth(0, 0.15, cycle) * (1 - smooth(0.8, 1, cycle)) * (0.5 + 0.5 * cycle);
    if (alpha < 0.01) continue;
    const r = reach * (0.04 + 0.96 * cycle * cycle);
    const k = (5 + 22 * cycle * cycle) / GLYPH_PX;
    const glyph = atlas[Math.floor(hash(i, Math.floor(t * 4)) * atlas.length)];
    ctx.globalAlpha = alpha;
    ctx.setTransform(base.a * k, 0, 0, base.d * k, base.a * (cx + Math.cos(angle) * r), base.d * (cy + Math.sin(angle) * r));
    ctx.drawImage(glyph, -glyph.width / 2, -glyph.height / 2);
  }
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}

function drawTitle(ctx: CanvasRenderingContext2D, base: DOMMatrix, size: Size, t: number) {
  const scale = titleScale(t);
  if (scale <= 0) return;
  const { restPx, widths, total } = titleLayout(ctx, size.width);
  if (restPx * scale < 1.2) return;
  const fadeIn = smooth(VOID_T.open, VOID_T.open + 0.9, t);
  const swell = Math.exp(-(((t - VOID_T.swell) / 0.22) ** 2));
  // Letters are laid out at the resting size and drawn through a transform (scale around the centre),
  // so the layout is computed once per size and the glyphs stay sharp at any scale.
  ctx.font = `700 ${restPx}px ${monoFamily()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tracking = TRACKING * restPx;
  const sprites = getGlowSprites(Math.round(restPx * 1.5));
  // Sharp letter sprites cover sizes up to 1.3x the resting size; beyond that (the rush through the
  // camera) the letters are text, and only those still on screen are drawn.
  const letterRef = Math.ceil(restPx * base.a * 1.3);
  const letterSprites = getLetterSprites(letterRef);
  const atlas = getRainAtlas();
  const cx = size.width / 2;
  const cy = size.height / 2;
  let x = -total / 2;
  for (let i = 0; i < VOID_TITLE.length; i++) {
    const mid = x + widths[i] / 2;
    x += widths[i] + tracking;
    const at = revealAt(i);
    const resolved = t >= at;
    const flare = resolved ? Math.exp(-(t - at) / 0.28) : 0;
    // A just-resolved letter pops slightly larger and settles.
    const k = scale * (1 + 0.22 * flare);
    const px = cx + mid * scale;
    const half = (widths[i] / 2 + restPx) * k;
    if (px + half < 0 || px - half > size.width) continue;
    const sx = base.a * k;
    const sy = base.d * k;
    if (resolved && sprites) {
      const sprite = sprites.byChar.get(VOID_TITLE[i]);
      if (sprite) {
        ctx.globalAlpha = fadeIn * Math.min(1, 0.32 + 0.68 * flare + 0.55 * swell);
        const f = restPx / sprites.refPx;
        ctx.setTransform(sx * f, 0, 0, sy * f, base.a * px, base.d * cy);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      }
    }
    ctx.globalAlpha = fadeIn * (resolved ? 1 : 0.4);
    if (!resolved) {
      // Before it resolves: a dimmer rain glyph cycling ~18 times a second, in the letter's cell.
      if (atlas) {
        const glyph = atlas[Math.floor(hash(i, Math.floor(t * 18)) * atlas.length)];
        const f = restPx / GLYPH_PX;
        ctx.setTransform(sx * f, 0, 0, sy * f, base.a * px, base.d * cy);
        ctx.drawImage(glyph, -glyph.width / 2, -glyph.height / 2);
      }
      continue;
    }
    const sprite = k <= 1.3 ? letterSprites?.byChar.get(VOID_TITLE[i]) : undefined;
    if (sprite && letterSprites) {
      const f = restPx / (letterSprites.refPx / base.a);
      ctx.setTransform((sx * f) / base.a, 0, 0, (sy * f) / base.d, base.a * px, base.d * cy);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    } else {
      ctx.fillStyle = `rgb(${LIGHT})`;
      ctx.setTransform(sx, 0, 0, sy, base.a * px, base.d * cy);
      ctx.fillText(VOID_TITLE[i], 0, 0);
    }
  }
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}

/**
 * Called by GateWarp once per frame while the void is on (and on under the flash), after the black
 * layer was painted, with a canvas context scaled to CSS pixels (origin = top-left of the visible
 * viewport).
 *
 * @param size  visible viewport in CSS px.
 * @param t     seconds since the click, from the sound's clock.
 * @param _u    progress through the void: 0 at the first black frame, 1 at the flash.
 */
export function drawVoid(ctx: CanvasRenderingContext2D, size: Size, t: number, _u: number): void {
  const base = ctx.getTransform();
  drawDepthLight(ctx, size, t);
  drawDust(ctx, base, size, t);
  drawTitle(ctx, base, size, t);
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}
