/**
 * The gate rabbit as vector paths (public/rabbit-gate.svg: a trace of the original drawing, three
 * flat layers: white silhouette, light shading, black lines). The entry warp zooms into the eye by
 * more than 50x, which a 440 px bitmap cannot survive; here the paths are drawn on a canvas every
 * frame at the current scale, so the eye stays razor sharp. Loaded while the viewer looks at the
 * rabbit; without it (fetch failed, no Path2D) the warp falls back to scaling the bitmap.
 */

export const RABBIT_SVG_URL = "/rabbit-gate.svg";

export type RabbitVector = {
  /** Edge of the (square) viewBox the paths are drawn in. */
  size: number;
  layers: ReadonlyArray<{ fill: string; path: Path2D }>;
};

/** `<path fill="#rrggbb" ... d="...">` elements and the viewBox of the traced SVG (pure, no DOM). */
export function parseRabbitSvg(svg: string): { size: number; layers: Array<{ fill: string; d: string }> } | null {
  const view = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!view) return null;
  const layers: Array<{ fill: string; d: string }> = [];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const fill = /\bfill="(#[0-9a-fA-F]{3,8})"/.exec(tag)?.[1];
    const d = /\bd="([^"]+)"/.exec(tag)?.[1];
    if (fill && d) layers.push({ fill, d });
  }
  return layers.length ? { size: Number(view[1]), layers } : null;
}

let loading: Promise<RabbitVector | null> | null = null;
let loaded: RabbitVector | null = null;

/** Fetches and parses the vector once; resolves null when it cannot be used. */
export function preloadRabbitVector(): Promise<RabbitVector | null> {
  if (loading) return loading;
  loading = (async () => {
    if (typeof fetch !== "function" || typeof Path2D === "undefined") return null;
    try {
      const response = await fetch(RABBIT_SVG_URL);
      if (!response.ok) return null;
      const parsed = parseRabbitSvg(await response.text());
      if (!parsed) return null;
      loaded = { size: parsed.size, layers: parsed.layers.map((l) => ({ fill: l.fill, path: new Path2D(l.d) })) };
      return loaded;
    } catch {
      return null;
    }
  })();
  return loading;
}

/** The vector, if it has finished loading (the click handler cannot wait for it). */
export function getRabbitVector(): RabbitVector | null {
  return loaded;
}

/**
 * Draws the rabbit into the square `box` (CSS px) under the camera transform
 * `translate(tx, ty) scale(scale)` (the same one the DOM content gets), on a canvas whose
 * coordinate system is already scaled by the device pixel ratio.
 */
export function drawRabbit(
  ctx: CanvasRenderingContext2D,
  vector: RabbitVector,
  box: { left: number; top: number; edge: number },
  camera: { tx: number; ty: number; scale: number },
  dpr: number,
): void {
  const k = (box.edge / vector.size) * camera.scale;
  ctx.setTransform(
    dpr * k,
    0,
    0,
    dpr * k,
    dpr * (camera.tx + camera.scale * box.left),
    dpr * (camera.ty + camera.scale * box.top),
  );
  for (const layer of vector.layers) {
    ctx.fillStyle = layer.fill;
    ctx.fill(layer.path, "evenodd");
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** @internal tests */
export function resetRabbitVectorForTests() {
  loading = null;
  loaded = null;
}
