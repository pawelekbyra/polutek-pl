/**
 * THE VOID: the black screen inside the pupil, between the end of the zoom (WARP.blackAt, 4.95 s)
 * and the final flash (WARP.flash, 11.3 s). Timed to the entry sound (gate-warp-timeline.ts):
 *
 * - 3.30 – 4.95 while the zoom closes in on the pupil, a point appears in its black core and grows
 *               into the tunnel (tunnelEmerge; drawn only inside the pupil, which is its window):
 *               when the pupil fills the screen (4.95 s, the sound's accent) the tunnel fills it too,
 *               so entering the pupil is entering the tunnel;
 * - from 3.30   the camera travels down the tube at one constant speed (the zoom's own tempo; it
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
import { RAIN_CONFIG } from "./matrix-rain-engine";

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
  /**
   * The tunnel appears as a point in the pupil and the camera starts travelling down it; it is seen
   * through the pupil (a window in the zooming rabbit) until the zoom enters the pupil.
   */
  tunnelFrom: 3.3,
  /** The pupil fills the screen on the sound's accent (= WARP.blackAt): so does the tunnel. */
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

const LIGHT = "247, 249, 252";
const TRACKING = 0.12; // letter spacing, in em
const FAR = 30; // starting distance of the title (1 = resting distance)
/**
 * The tunnel is a round tube (world units: half the screen's shorter side at depth 1 is 1). Its wall is one regular grid of glyph cells: TUBE_COLUMNS columns, a ring
 * every RING_STEP of depth, each cell CELL wide.
 */
const TUBE_COLUMNS = 96;
const CELL = 0.13;
const RING_STEP = 0.16;
/**
 * Fog: rings come out of it far away, so the tube runs almost to a point. The tube has no mouth (its
 * rings are laid from RING_ORIGIN, far behind the camera): it appears by growing (tunnelEmerge).
 */
const FOG_DEPTH = 18;
const RING_ORIGIN = -100;
/**
 * Camera speed in world units per second, constant. Rings at depth 2 grow at about the zoom's mean
 * rate into the rabbit (~1.35 e-folds per second), so the tunnel keeps the zoom's tempo.
 */
export const TUNNEL_SPEED = 2.8;

/**
 * The Japanese glyphs of the gate's rain (RAIN_CONFIG.chars without its digits), drawn in the rain's own
 * font ("monospace"), so the dust and the title's undecoded letters are the same characters as the
 * rain behind the rabbit. Pre-rendered once.
 */
const KANA = [...RAIN_CONFIG.chars].filter((ch) => !/[0-9]/.test(ch));
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
  return VOID_T.decodeFrom + i * VOID_T.decodeStep + (hash(i, 3) - 0.5) * 0.03;
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
 * An atlas of the rain's Japanese glyphs, white, rendered once: drawing them as text every frame goes
 * through font fallback and was the costliest part of the void on phones.
 */
let rainAtlas: HTMLCanvasElement[] | null = null;
function getRainAtlas(): HTMLCanvasElement[] | null {
  if (rainAtlas) return rainAtlas;
  const atlas: HTMLCanvasElement[] = [];
  for (const kana of KANA) {
    const c = makeCanvas(GLYPH_PX * 1.2, GLYPH_PX * 1.2);
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    g.font = `${GLYPH_PX}px monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = `rgb(${LIGHT})`;
    // The rain's own font, so the glyphs look exactly like the rain behind the rabbit.
    g.fillText(kana, c.width / 2, c.height / 2);
    atlas.push(c);
  }
  rainAtlas = atlas;
  return atlas;
}

/**
 * The same glyphs side by side on ONE canvas, for the tunnel's thousands of cells: drawing every cell
 * from its own small canvas switches the GPU texture per glyph (measured: ~2000 cells took over 100
 * ms a frame); from a single sheet the draws batch.
 */
let rainSheet: { sheet: HTMLCanvasElement; cell: number; count: number } | null = null;
function getRainSheet(): { sheet: HTMLCanvasElement; cell: number; count: number } | null {
  if (rainSheet) return rainSheet;
  const atlas = getRainAtlas();
  if (!atlas) return null;
  const cell = atlas[0].width;
  const sheet = makeCanvas(cell * atlas.length, cell);
  const g = sheet?.getContext("2d");
  if (!sheet || !g) return null;
  atlas.forEach((glyph, i) => g.drawImage(glyph, i * cell, 0));
  rainSheet = { sheet, cell, count: atlas.length };
  return rainSheet;
}

/** Renders the void's sprites ahead of time (call while nothing animates), so its first frame does not stall. */
export function prepareGateVoid(): void {
  getRainSheet();
  getLightSprite();
  if (typeof window !== "undefined") getRingSprites(window.innerWidth, window.innerHeight);
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

/**
 * The thickest point of a glyph (the spot farthest from any edge, found with a distance transform on
 * a one-off render), as an offset from the glyph's centre in units of its font size. Zooming into
 * that point keeps the screen white for longest. (0, 0) when nothing can be rendered.
 */
const glyphCores = new Map<string, { dx: number; dy: number }>();
export function glyphCore(ch: string): { dx: number; dy: number } {
  const known = glyphCores.get(ch);
  if (known) return known;
  const px = 120;
  const c = makeCanvas(px * 1.4, px * 1.4);
  const g = c?.getContext("2d");
  let core = { dx: 0, dy: 0 };
  if (c && g) {
    g.font = `700 ${px}px ${monoFamily()}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(ch, c.width / 2, c.height / 2);
    const { width: w, height: h } = c;
    const alpha = g.getImageData(0, 0, w, h).data;
    // Two-pass chamfer distance (1 / 1.4) from every inside pixel to the nearest outside pixel.
    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) dist[i] = alpha[i * 4 + 3] > 128 ? 1e6 : 0;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!dist[i]) continue;
        dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4);
      }
    }
    let best = 0;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        if (!dist[i]) continue;
        dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4);
        if (dist[i] > best) {
          best = dist[i];
          core = { dx: (x + 0.5 - w / 2) / px, dy: (y + 0.5 - h / 2) / px };
        }
      }
    }
  }
  glyphCores.set(ch, core);
  return core;
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

// --- Layers ---------------------------------------------------------------------------------------

type Size = { width: number; height: number };

function drawDepthLight(ctx: CanvasRenderingContext2D, size: Size, centre: { x: number; y: number }, t: number) {
  const open = smooth(VOID_T.tunnelFrom, VOID_T.tunnelFrom + 1, t) * (1 - 0.6 * smooth(VOID_T.arrive - 0.6, VOID_T.arrive + 0.4, t));
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

/**
 * The tunnel emerging out of the pupil: the whole tube is drawn scaled by this factor around the
 * vanishing point. It is born as a point in the pupil's core (VOID_T.tunnelFrom), grows in log space
 * alongside the zoom and reaches its full size exactly when the pupil fills the screen
 * (VOID_T.tunnelFull), easing out there so its growth hands over smoothly to the constant travel.
 */
const EMERGE_START = 0.01;
export function tunnelEmerge(t: number): number {
  const p = clamp01((t - VOID_T.tunnelFrom) / (VOID_T.tunnelFull - VOID_T.tunnelFrom));
  if (p <= 0) return 0;
  const q = 1 - (1 - p) ** 1.6;
  return EMERGE_START ** (1 - q);
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
const RING_VARIANTS = 4;
/** Pixel budget of one ring sprite (about 12 MB of memory at most each). */
const SPRITE_MAX_PIXELS = 3_000_000;
let ringSprites: { key: string; sprites: HTMLCanvasElement[]; w: number; h: number } | null = null;
function getRingSprites(width: number, height: number): { sprites: HTMLCanvasElement[]; w: number; h: number } | null {
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
  const res = Math.min(2, dpr, Math.sqrt(SPRITE_MAX_PIXELS / (w * h)));
  const sprites: HTMLCanvasElement[] = [];
  for (let v = 0; v < RING_VARIANTS; v++) {
    const c = makeCanvas(w * res, h * res);
    const g = c?.getContext("2d");
    if (!c || !g) return null;
    g.scale(res, res);
    for (let col = 0; col < TUBE_COLUMNS; col++) {
      if (hash(v * 977 + col, 9) < 0.22) continue;
      const glyph = Math.floor(hash(v * 977 + col, 23) * rain.count);
      const x = w / 2 + xs[col] * s - glyphPx / 2;
      const y = h / 2 + ys[col] * s - glyphPx / 2;
      g.drawImage(rain.sheet, glyph * rain.cell, 0, rain.cell, rain.cell, x, y, glyphPx, glyphPx);
    }
    sprites.push(c);
  }
  ringSprites = { key, sprites, w, h };
  return ringSprites;
}

/**
 * The tube, seen from inside: rings of glyph cells on its round wall at their depths, farthest first.
 * The rings are a regular grid (TUBE_COLUMNS columns running straight to the vanishing point
 * `centre`, rings every RING_STEP), all on the one surface; the glyphs have one even tone that
 * brightens as they come near and change now and then, like the rain. Near cells are drawn one by
 * one from the rain sheet (skipped when off screen or too faint), far rings as ring sprites.
 */
function drawTunnel(ctx: CanvasRenderingContext2D, size: Size, centre: { x: number; y: number }, t: number) {
  const rain = getRainSheet();
  const rings = getRingSprites(size.width, size.height);
  if (!rain || !rings) return;
  const { sheet, cell, count } = rain;
  const f = Math.min(size.width, size.height) / 2; // focal length: world 1 at depth 1 = half the shorter side
  const { xs, ys } = tubeColumns(size.width, size.height);
  const travel = tunnelTravel(t);
  // Ring k sits at world depth RING_ORIGIN + k * RING_STEP; the camera has moved `travel` towards it.
  const first = Math.ceil((travel + 0.9 - RING_ORIGIN) / RING_STEP);
  const last = Math.floor((travel + FOG_DEPTH - RING_ORIGIN) / RING_STEP);
  // Dimmer (never slower) while the title rests in front of it, so the address reads clearly.
  const dim = 1 - 0.35 * smooth(VOID_T.arrive - 0.6, VOID_T.arrive, t) * (1 - smooth(VOID_T.push, VOID_T.flash, t));
  // Out of the dark: the point fades in as it appears.
  const fadeIn = smooth(VOID_T.tunnelFrom, VOID_T.tunnelFrom + 0.3, t);
  const emerge = tunnelEmerge(t);
  if (emerge <= 0) return;
  for (let k = last; k >= first; k--) {
    const z = RING_ORIGIN + k * RING_STEP - travel;
    // Far away the rings crowd into a few pixels: every other one fades out beyond depth 3, and so on
    // (they fade back in as they come near, long before they are told apart).
    // Detail follows the size on screen: while the tunnel is still emerging (small), even its near
    // rings are as small as far ones, so they are thinned out and drawn as ring sprites too.
    const zs = z / emerge;
    const ringLod = k % 2 === 1 ? 1 - smooth(2.6, 3.4, zs) : k % 4 === 2 ? 1 - smooth(4, 5, zs) : k % 8 === 4 ? 1 - smooth(5.5, 6.5, zs) : k % 16 === 8 ? 1 - smooth(8, 9.5, zs) : 1;
    const ring = ringAlpha(z) * dim * ringLod * fadeIn;
    if (ring < 0.02) continue;
    const s = (f / z) * emerge;
    // Far: the whole ring as one pre-rendered sprite (changing now and then, like the rain); between
    // SPRITE_FROM and SPRITE_FULL it crossfades with the cells.
    const far = smooth(SPRITE_FROM, SPRITE_FULL, zs);
    if (far > 0) {
      const m = (SPRITE_AT / z) * emerge;
      const sprite = rings.sprites[Math.floor(hash(k, Math.floor(t * 1.5 + hash(k, 3) * 4)) * RING_VARIANTS)];
      ctx.globalAlpha = ring * far * (0.6 + 0.4 * Math.min(1, 1.6 / z));
      ctx.drawImage(sprite, centre.x - (rings.w * m) / 2, centre.y - (rings.h * m) / 2, rings.w * m, rings.h * m);
    }
    if (far >= 1) continue;
    const glyphPx = CELL * s;
    const half = glyphPx / 2;
    // The glyphs' light: one even tone, brighter as they come near.
    const near = 0.6 + 0.4 * Math.min(1, 1.6 / z);
    for (let c = 0; c < TUBE_COLUMNS; c++) {
      if (hash(k * 131 + c, 9) < 0.22) continue; // a gap in the column
      const px = centre.x + xs[c] * s;
      const py = centre.y + ys[c] * s;
      if (px < -half || py < -half || px > size.width + half || py > size.height + half) continue;
      const alpha = ring * (1 - far) * near;
      if (alpha < 0.03) continue;
      // Each cell changes its glyph now and then (about three times a second, cells out of step), like the rain.
      const glyph = Math.floor(hash(k * 977 + c, Math.floor(t * 3 + hash(c, k) * 3)) * count);
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
