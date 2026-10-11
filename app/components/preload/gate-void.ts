/**
 * THE VOID: the black screen inside the pupil, between the end of the zoom (WARP.blackAt, 4.95 s)
 * and the final flash (WARP.flash, 11.3 s). Timed to the entry sound (gate-warp-timeline.ts):
 *
 * - 4.87 – 5.80 the pupil has covered the screen and the camera enters it on the sound's accent (4.95):
 *               the tunnel builds itself out of the distance (tunnelFront; nothing shows inside the
 *               pupil before): its first glyph rings fly from the far end at the screen at the zoom's
 *               own tempo and the tube forms behind them, reaching the screen edges at about 5.65 s;
 * - from 4.25   the camera travels down the tube at one constant speed (the zoom's own tempo; it
 *               never slows with the title); the tube is round and passes the screen's corners, so
 *               every edge of the screen is covered, and it runs deep, almost to a point;
 * - 5.15 – 8.40 "WWW.PAWELPERFECT.COM" (one line) flies out of that depth and brakes to a stop in
 *               front of the viewer (perspective: its distance falls fast, then eases out); all the
 *               way its letters are cycling Japanese rain glyphs (the rain's own glyphs and font);
 * - 8.40 – 9.40 in place, the letters decode one by one into the address, each with a flare, and
 *               the sound's swell (8.5 s) sends a glow through it;
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
import {
  AIM_CANDIDATES,
  VOID_T,
  VOID_TITLE,
  hash,
  revealAt,
  smooth,
  titleScale,
  type Size,
} from "./gate-void-timing";
import {
  GLYPH_PX,
  getGlowSprites,
  getLetterSprites,
  getLightSprite,
  getRainAtlas,
  getRainSheet,
  glyphCore,
  LIGHT,
  monoFamily,
  releaseVoidSprites,
} from "./gate-void-sprites";
import { drawDepthLight, drawTunnel, getRingSprites, releaseVoidTunnel } from "./gate-void-tunnel";

// The public surface of the void stays here (GateWarp, PageRevealGate and the tests import it).
export {
  AIM_CANDIDATES,
  TUNNEL_SPEED,
  VOID_T,
  VOID_TITLE,
  revealAt,
  titleScale,
  tunnelFront,
  tunnelTravel,
  zoomEndRate,
} from "./gate-void-timing";
export { drawTunnelWindow, tubeColumns } from "./gate-void-tunnel";
export { glyphCore } from "./gate-void-sprites";

const TRACKING = 0.12; // letter spacing, in em

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

/**
 * Drops every sprite the void rendered (glyph atlas and sheet, ring sprites with their mipmaps,
 * letters, glows, light): tens of MB of canvas memory on a desktop, useless once the viewer is in
 * (the gate does not come back in this tab).
 */
export function releaseGateVoid(): void {
  releaseVoidSprites();
  releaseVoidTunnel();
  layout = null;
}

/** Renders the void's sprites ahead of time (call while nothing animates), so its first frame does not stall. */
export function prepareGateVoid(): void {
  getRainSheet();
  getLightSprite();
  if (typeof window !== "undefined") getRingSprites(window.innerWidth, window.innerHeight);
}

/** Of the candidate letters, the thickest point nearest the title's centre (title coordinates, px). */
function aimPoint(widths: number[], tracking: number, total: number, restPx: number): { x: number; y: number } {
  let best = { x: 0, y: 0 };
  let bestDistance = Infinity;
  for (const i of AIM_CANDIDATES) {
    const mid = -total / 2 + widths.slice(0, i).reduce((a, b) => a + b, 0) + tracking * i + widths[i] / 2;
    const core = glyphCore(VOID_TITLE[i]);
    const p = { x: mid + core.dx * restPx, y: core.dy * restPx };
    const d = Math.hypot(p.x, p.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = p;
    }
  }
  return best;
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
  // The zoom's centre: the title's centre while it flies in, then, very slowly over the whole time it
  // rests and rushes (too slowly to be seen), the thickest point of the aimed letter, which reaches the
  // screen centre just before the flash.
  const target = aimPoint(widths, tracking, total, restPx);
  const aim = smooth(VOID_T.arrive, VOID_T.flash - 0.1, t);
  const fx = target.x * aim;
  const fy = target.y * aim;
  let x = -total / 2;
  for (let i = 0; i < VOID_TITLE.length; i++) {
    const mid = x + widths[i] / 2;
    x += widths[i] + tracking;
    const at = revealAt(i);
    const resolved = t >= at;
    const flare = resolved ? Math.exp(-(t - at) / 0.28) : 0;
    // A just-resolved letter pops slightly larger and settles.
    const k = scale * (1 + 0.22 * flare);
    const px = cx + (mid - fx) * scale;
    const py = cy - fy * scale;
    const half = (widths[i] / 2 + restPx) * k;
    if (px + half < 0 || px - half > size.width || py + half < 0 || py - half > size.height) continue;
    const sx = base.a * k;
    const sy = base.d * k;
    if (resolved && sprites) {
      const sprite = sprites.byChar.get(VOID_TITLE[i]);
      if (sprite) {
        ctx.globalAlpha = fadeIn * Math.min(1, 0.32 + 0.68 * flare + 0.55 * swell);
        const f = restPx / sprites.refPx;
        ctx.setTransform(sx * f, 0, 0, sy * f, base.a * px, base.d * py);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      }
    }
    ctx.globalAlpha = fadeIn * (resolved ? 1 : 0.85);
    if (!resolved) {
      // Before it resolves: a dimmer rain glyph cycling ~18 times a second, in the letter's cell.
      if (atlas) {
        const glyph = atlas[Math.floor(hash(i, Math.floor(t * 18)) * atlas.length)];
        const f = restPx / GLYPH_PX;
        ctx.setTransform(sx * f, 0, 0, sy * f, base.a * px, base.d * py);
        ctx.drawImage(glyph, -glyph.width / 2, -glyph.height / 2);
      }
      continue;
    }
    const sprite = k <= 1.3 ? letterSprites?.byChar.get(VOID_TITLE[i]) : undefined;
    if (sprite && letterSprites) {
      const f = restPx / (letterSprites.refPx / base.a);
      ctx.setTransform((sx * f) / base.a, 0, 0, (sy * f) / base.d, base.a * px, base.d * py);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    } else {
      ctx.fillStyle = `rgb(${LIGHT})`;
      ctx.setTransform(sx, 0, 0, sy, base.a * px, base.d * py);
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
  const centre = { x: size.width / 2, y: size.height / 2 };
  drawDepthLight(ctx, size, centre, t);
  drawTunnel(ctx, size, centre, t);
  drawTitle(ctx, base, size, t);
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}
