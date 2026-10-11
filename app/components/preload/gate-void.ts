/**
 * THE VOID: the black screen inside the pupil, between the end of the zoom (WARP.blackAt, 4.95 s)
 * and the final flash (WARP.flash, 11.3 s). Timed to the entry sound (gate-warp-timeline.ts):
 *
 * - 5.15        a point of light opens in the depth of the pupil and the camera starts travelling
 *               down a tunnel whose walls are rain glyphs (they grow and slide outwards as they come
 *               near, in perspective; the camera races, crawls and bolts with the action);
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
/** Glyphs on the walls of the tunnel the camera travels through. */
const TUNNEL_GLYPHS = 150;
/** Depth of the tunnel segment in view (world units; the wall radius is 1). */
const TUNNEL_DEPTH = 6;
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

/**
 * How fast the camera travels down the tunnel (world units per second): it races while the title flies
 * in, slows to a crawl while the title rests, speeds up with the rush and bolts inside the flash.
 */
function tunnelSpeed(t: number): number {
  const flight = 1 - smooth(VOID_T.open + 1.2, VOID_T.arrive, t);
  return 0.5 + 2.4 * flight * smooth(VOID_T.open, VOID_T.open + 0.6, t) + 6 * smooth(VOID_T.push, VOID_T.flash, t) + 22 * smooth(VOID_T.flash, VOID_T.flash + 0.2, t);
}

/** Distance travelled since the void opened: the integral of tunnelSpeed, tabulated once (10 ms steps). */
const TRAVEL_STEP = 0.01;
let travelTable: Float64Array | null = null;
export function tunnelTravel(t: number): number {
  if (t <= VOID_T.open) return 0;
  if (!travelTable) {
    const n = Math.ceil((VOID_T.flash + 1 - VOID_T.open) / TRAVEL_STEP) + 1;
    travelTable = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      const tt = VOID_T.open + (i - 0.5) * TRAVEL_STEP;
      travelTable[i] = travelTable[i - 1] + tunnelSpeed(tt) * TRAVEL_STEP;
    }
  }
  const x = (t - VOID_T.open) / TRAVEL_STEP;
  const i = Math.min(travelTable.length - 2, Math.floor(x));
  const f = Math.min(1, x - i);
  return travelTable[i] + (travelTable[i + 1] - travelTable[i]) * f;
}

/**
 * The tunnel: rain glyphs fixed on the walls of a cylinder around the camera's axis, in perspective.
 * Far away they are small and close to the centre; as the camera travels they come nearer, grow and
 * slide out to the edges (size and distance from the centre both go with 1 / depth), then a new one
 * appears in the depth. Pre-rendered glyph sprites, one transform per glyph.
 */
function drawTunnel(ctx: CanvasRenderingContext2D, base: DOMMatrix, size: Size, t: number) {
  const atlas = getRainAtlas();
  if (!atlas) return;
  const cx = size.width / 2;
  const cy = size.height / 2;
  const focal = Math.min(size.width, size.height) * 0.42;
  const fadeIn = smooth(VOID_T.open, VOID_T.open + 1.2, t);
  const travel = tunnelTravel(t);
  for (let i = 0; i < TUNNEL_GLYPHS; i++) {
    const angle = hash(i, 11) * Math.PI * 2;
    const radius = 0.8 + 0.45 * hash(i, 13);
    // Depth from TUNNEL_DEPTH (far) to 0 (at the camera), repeating as the camera travels.
    const z = TUNNEL_DEPTH - ((hash(i, 7) * TUNNEL_DEPTH + travel) % TUNNEL_DEPTH);
    const zz = z + 0.12;
    const alpha = fadeIn * 0.75 * smooth(TUNNEL_DEPTH, TUNNEL_DEPTH * 0.8, z) * smooth(0.12, 0.45, z) * (0.45 + 0.55 * Math.min(1, 1.6 / zz));
    if (alpha < 0.01) continue;
    const px = cx + (Math.cos(angle) * radius * focal) / zz;
    const py = cy + (Math.sin(angle) * radius * focal) / zz;
    const glyphPx = Math.min(160, (focal * 0.1) / zz);
    if (px < -glyphPx || py < -glyphPx || px > size.width + glyphPx || py > size.height + glyphPx) continue;
    const k = glyphPx / GLYPH_PX;
    // Each glyph changes now and then, like the rain.
    const glyph = atlas[Math.floor(hash(i, Math.floor(t * 3 + hash(i, 17) * 3)) * atlas.length)];
    ctx.globalAlpha = alpha;
    ctx.setTransform(base.a * k, 0, 0, base.d * k, base.a * px, base.d * py);
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
  drawDepthLight(ctx, size, t);
  drawTunnel(ctx, base, size, t);
  drawTitle(ctx, base, size, t);
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}
