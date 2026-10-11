/**
 * The gate rabbit as vector paths (the active variant's traced SVG, gate-rabbit.ts: three flat layers:
 * white silhouette, light shading, black lines). The entry warp zooms into its black spot by
 * more than 50x, which a 440 px bitmap cannot survive; here the paths are drawn on a canvas every
 * frame at the current scale, so the eye stays razor sharp. Loaded while the viewer looks at the
 * rabbit; without it (fetch failed, no Path2D) the warp falls back to scaling the bitmap.
 */

import { GATE_RABBIT } from "./gate-rabbit";

export const RABBIT_SVG_URL = GATE_RABBIT.svg;

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
      warmUp(loaded);
      return loaded;
    } catch {
      return null;
    }
  })();
  return loading;
}

/**
 * The first fill of these paths costs tens of milliseconds (the browser prepares them), which would
 * be a stutter in the warp's first frame: pay it now, on a tiny offscreen canvas, while the gate loads.
 */
function warmUp(vector: RabbitVector): void {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (const scale of [64 / vector.size, (64 / vector.size) * 40]) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      for (const layer of vector.layers) {
        ctx.fillStyle = layer.fill;
        ctx.fill(layer.path, "evenodd");
      }
    }
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    /* only an optimisation */
  }
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
  /** 0..1: the soft dark glow the rabbit has under a mouse (CSS drop-shadow 14 px), faded by the caller. */
  glow = 0,
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
  vector.layers.forEach((layer, i) => {
    // Only the outer silhouette casts the glow (the inner layers would darken the white body).
    const glowing = i === 0 && glow > 0.01;
    if (glowing) {
      ctx.shadowColor = `rgba(17, 24, 39, ${0.25 * glow})`;
      ctx.shadowBlur = 14 * dpr * camera.scale;
    }
    ctx.fillStyle = layer.fill;
    ctx.fill(layer.path, "evenodd");
    if (glowing) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
  });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Drops the parsed rabbit once the entry is over (the gate does not come back in this tab). */
export function releaseRabbitVector(): void {
  loaded = null;
}

/** @internal tests */
export function resetRabbitVectorForTests() {
  loading = null;
  loaded = null;
}
