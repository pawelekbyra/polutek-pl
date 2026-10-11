/**
 * The void's sprites: everything drawn once to a small canvas and then only copied (scaled) every
 * frame, so nothing is blurred or laid out as text per frame on a phone. The rain's glyph atlas and
 * sheet, the soft light disc, the title's sharp letters and their glow halos, and glyphCore (the
 * thickest point of a letter, for the final dive).
 */
import { RAIN_CONFIG } from "./matrix-rain-engine";
import { VOID_TITLE } from "./gate-void-timing";

export const LIGHT = "247, 249, 252";

/**
 * The Japanese glyphs of the gate's rain (RAIN_CONFIG.chars without its digits), drawn in the rain's own
 * font ("monospace"), so the dust and the title's undecoded letters are the same characters as the
 * rain behind the rabbit. Pre-rendered once.
 */
const KANA = [...RAIN_CONFIG.chars].filter((ch) => !/[0-9]/.test(ch));
export const GLYPH_PX = 40;

let family: string | null = null;
export function monoFamily(): string {
  if (family) return family;
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  family = `${v ? `${v}, ` : ""}ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  return family;
}

// --- Sprites: rendered once, copied every frame -----------------------------------------------

export function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

let lightSprite: HTMLCanvasElement | null = null;
/** A soft white disc (light from the depth), 256 px, drawn scaled. */
export function getLightSprite(): HTMLCanvasElement | null {
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
export function getRainAtlas(): HTMLCanvasElement[] | null {
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
export function getRainSheet(): { sheet: HTMLCanvasElement; cell: number; count: number } | null {
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

/** The title's letters themselves (sharp, no glow) at about the device resolution of their resting size. */
export type LetterSprites = { refPx: number; byChar: Map<string, HTMLCanvasElement> };
let letters: LetterSprites | null = null;
export function getLetterSprites(refPx: number): LetterSprites | null {
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
export type GlowSprites = { refPx: number; pad: number; byChar: Map<string, HTMLCanvasElement> };
let glow: GlowSprites | null = null;
export function getGlowSprites(refPx: number): GlowSprites | null {
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

/** Drops the sprites this module rendered (the gate does not come back in this tab). */
export function releaseVoidSprites(): void {
  rainAtlas = null;
  rainSheet = null;
  letters = null;
  glow = null;
  lightSprite = null;
}
