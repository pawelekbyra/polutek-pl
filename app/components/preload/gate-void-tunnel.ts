/**
 * The tunnel: a round tube of Japanese rain glyphs seen from inside, its depth light, and the window
 * through which it shows inside the pupil before the camera enters. Near cells are drawn one by one
 * from the rain sheet, far rings as pre-rendered ring sprites (with mipmaps).
 */
import { VOID_T, clamp01, hash, smooth, tunnelFront, tunnelTravel, type Size } from "./gate-void-timing";
import { getLightSprite, getRainSheet, makeCanvas } from "./gate-void-sprites";

/**
 * The tunnel is a round tube (world units: half the screen's shorter side at depth 1 is 1). Its wall is one regular grid of glyph cells: TUBE_COLUMNS columns, a ring
 * every RING_STEP of depth, each cell CELL wide.
 */
const TUBE_COLUMNS = 96;
const CELL = 0.13;
const RING_STEP = 0.16;
/**
 * Fog: rings come out of it far away, so the tube runs almost to a point. The tube has no mouth (its
 * rings are laid from RING_ORIGIN, far behind the camera): it builds itself from the distance (tunnelFront).
 */
const FOG_DEPTH = 18;
const RING_ORIGIN = -100;

export function drawDepthLight(ctx: CanvasRenderingContext2D, size: Size, centre: { x: number; y: number }, t: number) {
  // Lights up with the tunnel, on the entry (no glow inside the pupil before it covers the screen).
  const open = smooth(VOID_T.tunnelFull - 0.08, VOID_T.tunnelFull + 0.6, t) * (1 - 0.6 * smooth(VOID_T.arrive - 0.6, VOID_T.arrive + 0.4, t));
  const rush = smooth(VOID_T.push, VOID_T.flash, t);
  const strength = 0.16 * open + 0.22 * rush;
  const sprite = getLightSprite();
  if (strength < 0.005 || !sprite) return;
  // Small: a glow wider than the tube's far end reads as a hole in the middle.
  const radius = Math.min(size.width, size.height) * (0.07 + 0.5 * rush);
  ctx.globalAlpha = strength;
  ctx.drawImage(sprite, centre.x - radius, centre.y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

/** Brightness of a ring at depth z: it comes out of the fog in the distance. */
function ringAlpha(z: number): number {
  // Deep: the rings close in on the vanishing point until the hole in the middle is a few pixels.
  return 0.75 * (1 - smooth(FOG_DEPTH * 0.7, FOG_DEPTH, z));
}

/**
 * The columns of the tube's wall for a viewport: TUBE_COLUMNS points evenly round its round
 * cross-section. The circle passes through the screen's corners, so at depth 1 the wall just leaves
 * the screen at its corners and, nearer the middle of each edge, the rings a bit further away cover
 * it: no edge is ever left empty. World units at depth 1.
 */
let columnsFor: { key: string; xs: Float64Array; ys: Float64Array } | null = null;
export function tubeColumns(width: number, height: number): { xs: Float64Array; ys: Float64Array } {
  const key = `${width}x${height}`;
  if (columnsFor && columnsFor.key === key) return columnsFor;
  const f = Math.min(width, height) / 2;
  const radius = Math.hypot(width / 2, height / 2) / f;
  const xs = new Float64Array(TUBE_COLUMNS);
  const ys = new Float64Array(TUBE_COLUMNS);
  for (let c = 0; c < TUBE_COLUMNS; c++) {
    const a = ((c + 0.5) / TUBE_COLUMNS) * Math.PI * 2;
    xs[c] = radius * Math.cos(a);
    ys[c] = radius * Math.sin(a);
  }
  columnsFor = { key, xs, ys };
  return columnsFor;
}

/**
 * Whole rings pre-rendered for the far part of the tube (depth beyond SPRITE_FROM): there each ring
 * is one drawImage instead of ~70 cells (the cells are a few pixels there, the stream's motion is not
 * distinguishable). Rendered at the size of a ring at depth SPRITE_AT, so they are only ever scaled down.
 * Rebuilt when the viewport changes (the tube's radius follows the screen's diagonal).
 */
const SPRITE_AT = 1.7;
const SPRITE_FROM = 1.8;
const SPRITE_FULL = 2.4;
const RING_VARIANTS = 6;
/** Pixel budget of one ring sprite's full-size level (about 8 MB of memory at most). */
const SPRITE_MAX_PIXELS = 2_000_000;
/**
 * Each ring sprite comes with smaller copies (halved down to ~64 px; "mipmaps"): canvas scales an image
 * down without them by sampling a few of its pixels, and a far or still small ring then twinkled from
 * frame to frame as its scale changed. The copy nearest to (and not smaller than) the drawn size is used.
 */
type RingSprite = HTMLCanvasElement[];
let ringSprites: { key: string; sprites: RingSprite[]; w: number; h: number } | null = null;
export function getRingSprites(width: number, height: number): { sprites: RingSprite[]; w: number; h: number } | null {
  const key = `${width}x${height}`;
  if (ringSprites && ringSprites.key === key) return ringSprites;
  const rain = getRainSheet();
  if (!rain) return null;
  const { xs, ys } = tubeColumns(width, height);
  const s = Math.min(width, height) / 2 / SPRITE_AT;
  const glyphPx = CELL * s * 1.2;
  const w = 2 * (Math.max(...xs) * s + glyphPx);
  const h = 2 * (Math.max(...ys) * s + glyphPx);
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const res = Math.min(1.5, dpr, Math.sqrt(SPRITE_MAX_PIXELS / (w * h)));
  const sprites: RingSprite[] = [];
  for (let v = 0; v < RING_VARIANTS; v++) {
    const c = makeCanvas(w * res, h * res);
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    g.scale(res, res);
    for (let col = 0; col < TUBE_COLUMNS; col++) {
      const glyph = ringGlyph(v, col, rain.count);
      if (glyph < 0) continue;
      const x = w / 2 + xs[col] * s - glyphPx / 2;
      const y = h / 2 + ys[col] * s - glyphPx / 2;
      g.drawImage(rain.sheet, glyph * rain.cell, 0, rain.cell, rain.cell, x, y, glyphPx, glyphPx);
    }
    const levels: RingSprite = [c];
    for (let prev = c; prev.width > 128 && prev.height > 128; ) {
      const next = makeCanvas(prev.width / 2, prev.height / 2);
      const ng = next?.getContext("2d");
      if (!next || !ng) break;
      ng.imageSmoothingQuality = "high";
      ng.drawImage(prev, 0, 0, next.width, next.height);
      levels.push(next);
      prev = next;
    }
    sprites.push(levels);
  }
  ringSprites = { key, sprites, w, h };
  return ringSprites;
}

/**
 * The resting glyph of a ring layout's column (-1: a gap). Ring sprites and single cells share it, so
 * a ring coming near changes from its sprite to cells without its pattern changing.
 */
function ringGlyph(variant: number, col: number, count: number): number {
  if (hash(variant * 977 + col, 9) < 0.22) return -1;
  return Math.floor(hash(variant * 977 + col, 23) * count);
}

/**
 * Draws a ring sprite at `w` x `h` CSS px: from the smallest level not smaller than the drawn size,
 * blended into the next smaller one as the size approaches it (as a GPU does between mipmaps), so the
 * ring does not pulse in brightness when the level changes.
 */
function drawRingSprite(ctx: CanvasRenderingContext2D, levels: RingSprite, x: number, y: number, w: number, h: number, alpha: number, deviceScale: number) {
  const devicePx = w * deviceScale;
  let i = 0;
  while (i + 1 < levels.length && levels[i + 1].width >= devicePx) i++;
  const next = levels[i + 1];
  const blend = next ? clamp01(Math.log2(levels[i].width / Math.max(1, devicePx))) : 0;
  ctx.globalAlpha = alpha * (1 - blend);
  ctx.drawImage(levels[i], x, y, w, h);
  if (next && blend > 0.02) {
    ctx.globalAlpha = alpha * blend;
    ctx.drawImage(next, x, y, w, h);
  }
}

/**
 * The tube, seen from inside: rings of glyph cells on its round wall at their depths, farthest first.
 * The rings are a regular grid (TUBE_COLUMNS columns running straight to the vanishing point
 * `centre`, rings every RING_STEP), all on the one surface; the glyphs have one even tone that
 * brightens as they come near and change now and then, like the rain. Near cells are drawn one by
 * one from the rain sheet (skipped when off screen or too faint), far rings as ring sprites.
 */
export function drawTunnel(ctx: CanvasRenderingContext2D, size: Size, centre: { x: number; y: number }, t: number) {
  const rain = getRainSheet();
  const rings = getRingSprites(size.width, size.height);
  if (!rain || !rings) return;
  const { sheet, cell, count } = rain;
  const deviceScale = ctx.getTransform().a || 1;
  const f = Math.min(size.width, size.height) / 2; // focal length: world 1 at depth 1 = half the shorter side
  const { xs, ys } = tubeColumns(size.width, size.height);
  const travel = tunnelTravel(t);
  // Ring k sits at world depth RING_ORIGIN + k * RING_STEP; the camera has moved `travel` towards it.
  const last = Math.floor((travel + FOG_DEPTH - RING_ORIGIN) / RING_STEP);
  // Dimmer (never slower) while the title rests in front of it, so the address reads clearly.
  const dim = 1 - 0.35 * smooth(VOID_T.arrive - 0.6, VOID_T.arrive, t) * (1 - smooth(VOID_T.push, VOID_T.flash, t));
  // One entry only, on the sound's accent: nothing shows inside the pupil while it does not fill the
  // screen yet; then the tunnel builds itself from the distance towards the viewer (tunnelFront).
  const front = tunnelFront(t);
  if (!Number.isFinite(front)) return;
  // Nearest ring drawn: the one just past the screen edge (depth 0.9 at full size, nearer while smaller).
  const first = Math.ceil((travel + Math.max(0.9, front) - RING_ORIGIN) / RING_STEP);
  for (let k = last; k >= first; k--) {
    const z = RING_ORIGIN + k * RING_STEP - travel;
    // Far away the rings crowd into a few pixels: every other one fades out beyond depth 3, and so on
    // (they fade back in as they come near, long before they are told apart).
    const zs = z;
    const ringLod = k % 2 === 1 ? 1 - smooth(2.6, 3.4, zs) : k % 4 === 2 ? 1 - smooth(4, 5, zs) : k % 8 === 4 ? 1 - smooth(5.5, 6.5, zs) : k % 16 === 8 ? 1 - smooth(8, 9.5, zs) : 1;
    // The rings just behind the front fade in; the leading ones are lit up a little, so the first
    // glyphs read as coming at the screen and building the tube.
    const behind = front > 0 ? (z - front) / (0.35 * front) : 99;
    const building = front > 0 ? smooth(0, 1, behind) * (1 + 0.6 * Math.exp(-behind)) : 1;
    const ring = Math.min(1, ringAlpha(z) * dim * ringLod * building);
    if (ring < 0.02) continue;
    const s = f / z;
    // Each ring keeps one layout (no swapping of its whole pattern: a small ring doing that flickered).
    const variant = Math.floor(hash(k, 3) * RING_VARIANTS);
    // Far: the whole ring as one pre-rendered sprite; between SPRITE_FROM and SPRITE_FULL it crossfades
    // with the cells, which show the same glyphs in the same places.
    const far = smooth(SPRITE_FROM, SPRITE_FULL, zs);
    if (far > 0) {
      const m = SPRITE_AT / z;
      drawRingSprite(ctx, rings.sprites[variant], centre.x - (rings.w * m) / 2, centre.y - (rings.h * m) / 2, rings.w * m, rings.h * m, ring * far * (0.6 + 0.4 * Math.min(1, 1.6 / z)), deviceScale);
    }
    if (far >= 1) continue;
    const glyphPx = CELL * s;
    const half = glyphPx / 2;
    // The glyphs' light: one even tone, brighter as they come near.
    const near = 0.6 + 0.4 * Math.min(1, 1.6 / z);
    for (let c = 0; c < TUBE_COLUMNS; c++) {
      const resting = ringGlyph(variant, c, count);
      if (resting < 0) continue; // a gap in the column
      const px = centre.x + xs[c] * s;
      const py = centre.y + ys[c] * s;
      if (px < -half || py < -half || px > size.width + half || py > size.height + half) continue;
      const alpha = ring * (1 - far) * near;
      if (alpha < 0.03) continue;
      // Once near (each cell from its own depth, so they do not all switch at once) a cell starts
      // changing its glyph now and then, about three times a second, like the rain; before that it
      // keeps the glyph its ring sprite shows.
      const cycling = zs < 1.2 + 0.5 * hash(k * 31 + c, 41);
      const glyph = cycling ? Math.floor(hash(k * 977 + c, Math.floor(t * 3 + hash(c, k) * 3)) * count) : resting;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sheet, glyph * cell, 0, cell, cell, px - half * 1.2, py - half * 1.2, glyphPx * 1.2, glyphPx * 1.2);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * The tunnel seen through the pupil before the camera is inside it (VOID_T.tunnelFrom → WARP.blackAt):
 * drawn only inside the pupil's black core (`window`, CSS px on screen), on top of the zooming rabbit.
 */
export function drawTunnelWindow(
  ctx: CanvasRenderingContext2D,
  size: Size,
  t: number,
  window: { x: number; y: number; r: number },
): void {
  if (t < VOID_T.tunnelFrom || window.r < 4) return;
  const base = ctx.getTransform();
  ctx.save();
  ctx.beginPath();
  ctx.arc(window.x, window.y, window.r, 0, Math.PI * 2);
  ctx.clip();
  drawDepthLight(ctx, size, window, t);
  drawTunnel(ctx, size, window, t);
  ctx.restore();
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}

/** Drops the ring sprites and the cached columns. */
export function releaseVoidTunnel(): void {
  ringSprites = null;
  columnsFor = null;
}
