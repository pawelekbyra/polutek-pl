"use client";

import { useEffect, useRef } from "react";
import type { GateClock } from "./gate-sound";
import { RAIN_CONFIG } from "./matrix-rain-engine";
import { WARP, cameraAt, flashAt, maxZoom, pupilAt, smoothstep, tunnelAt, type Point } from "./gate-warp-timeline";

/**
 * The entry warp drawn over the gate after the click (timeline: gate-warp-timeline.ts, sound:
 * gate-sound.ts). The camera is a CSS transform on the gate's own content (rain, prompt, rabbit),
 * so the zoom shows the real rabbit; this canvas adds what the DOM cannot: the crisp pupil that
 * opens into a hole, the spiralling tunnel of code glyphs inside it and the light flash.
 * Everything per frame is written straight to the DOM/canvas (no React state), driven by the
 * sound's clock. A click or key press skips to the flash.
 */

export type WarpStart = {
  /** Pupil centre and radius on screen (CSS px) when the click happened. */
  pupil: Point & { r: number };
  clock: GateClock;
};

const INK = "#f7f9fc";
const HOLE = "#04060a";
const RINGS = 36;
const RING_GAP = 0.36;
const Z_NEAR = 0.38;
const MAX_DPR = 1.5;

/** Small deterministic hash (glyph choice, column thinning) so the tunnel does not flicker randomly. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number, center: Point, t: number, dpr: number) {
  const tun = tunnelAt(t);
  // Trails: the previous frame fades instead of being cleared, so fast glyphs streak.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(4, 6, 10, 0.38)";
  ctx.fillRect(0, 0, w, h);
  if (!tun.visible) return;
  const focal = Math.hypot(w, h) * 0.3;
  // More columns on larger screens, so the walls stay dense.
  const columns = Math.max(28, Math.min(44, Math.round(Math.hypot(w, h) / 34)));
  const depth = RINGS * RING_GAP;
  const chars = RAIN_CONFIG.chars;
  const shift = tun.travel * RING_GAP;
  // The far end of the tunnel glows: the light the viewer is falling towards.
  ctx.globalAlpha = 1;
  const glowR = Math.min(w, h) * (0.3 + 0.25 * tun.intensity);
  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, glowR);
  glow.addColorStop(0, `rgba(214, 226, 255, ${0.22 * tun.intensity})`);
  glow.addColorStop(1, "rgba(214, 226, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(center.x - glowR, center.y - glowR, glowR * 2, glowR * 2);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let k = 0; k < RINGS; k++) {
    const raw = k * RING_GAP - (shift % RING_GAP);
    const z = Z_NEAR + raw;
    const ringId = k + Math.floor(shift / RING_GAP);
    const radius = focal / z;
    const size = Math.max(6, Math.min(84, (focal * 0.15) / z));
    const far = 1 - smoothstep(depth * 0.45, depth, raw);
    const near = smoothstep(Z_NEAR, Z_NEAR + 0.5, z);
    const alpha = tun.intensity * far * near;
    if (alpha <= 0.02) continue;
    ctx.font = `${Math.round(size)}px monospace`;
    for (let i = 0; i < columns; i++) {
      if (hash(i, 7) > tun.density) continue;
      const angle = (i / columns) * Math.PI * 2 + tun.spin + z * 0.42;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      if (x < -size || y < -size || x > w + size || y > h + size) continue;
      // Every few rings a brighter "head", like the rain.
      const head = (ringId + i) % 9 === 0;
      ctx.globalAlpha = Math.min(1, alpha * (head ? 1 : 0.78));
      const glyph = chars.charAt(Math.floor(hash(i, ringId + Math.floor(t * 6) * (head ? 1 : 0)) * chars.length));
      const c = Math.cos(angle + Math.PI / 2);
      const s = Math.sin(angle + Math.PI / 2);
      ctx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, x * dpr, y * dpr);
      ctx.fillText(glyph, 0, 0);
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
}

export function GateWarp({
  start,
  camera,
  screen,
  onFlash,
  onDone,
}: {
  start: WarpStart;
  /** The gate content the camera moves (rain + prompt + rabbit). */
  camera: HTMLElement | null;
  /** The gate screen itself (faded out at the end). */
  screen: HTMLElement | null;
  onFlash: () => void;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onFlash, onDone });
  useEffect(() => {
    callbacks.current = { onFlash, onDone };
  }, [onFlash, onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      callbacks.current.onFlash();
      callbacks.current.onDone();
      return;
    }
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let w = 0;
    let h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      for (const c of [canvas, layer]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      // The visible viewport (the gate screen itself may be taller under a phone's bottom bar).
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    size();
    window.addEventListener("resize", size);

    const { pupil, clock } = start;
    const center = { x: w / 2, y: h / 2 };
    const zoom = maxZoom(pupil.r, { width: w, height: h });
    const cover = Math.hypot(w, h) * 0.62;
    if (screen) screen.style.transition = "none";
    if (camera) {
      camera.style.transformOrigin = "0 0";
      camera.style.willChange = "transform";
    }

    let skipBy = 0;
    const skip = () => {
      const t = clock.now() + skipBy;
      if (t < WARP.flash - 0.4) {
        skipBy += WARP.flash - 0.4 - t;
        clock.stop(0.35);
      }
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);

    let flashed = false;
    let raf = 0;
    const frame = () => {
      const t = clock.now() + skipBy;
      const cam = cameraAt(t, pupil, center, zoom);
      const hole = pupilAt(t, pupil, center, zoom, cover);
      if (camera) {
        // Rotate around the pupil's current screen position (the space is pulled into it).
        camera.style.transform =
          `translate(${hole.x}px, ${hole.y}px) rotate(${cam.rotate}rad) translate(${-hole.x}px, ${-hole.y}px) ` +
          `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`;
        camera.style.setProperty("--warp-text", String(cam.textOpacity));
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const flash = flashAt(t);
      if (t < WARP.flashEnd) {
        // The hole: a crisp pupil over the (soft, upscaled) bitmap, then the opening.
        if (hole.opacity > 0) {
          ctx.globalAlpha = hole.opacity;
          ctx.fillStyle = HOLE;
          ctx.beginPath();
          ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
          ctx.fill();
          // The glint of the eye, gone once the pupil starts to open.
          const glint = 1 - smoothstep(WARP.burstStart, WARP.burstStart + 0.25, t);
          if (glint > 0) {
            ctx.globalAlpha = hole.opacity * glint * 0.9;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(hole.x - hole.r * 0.32, hole.y - hole.r * 0.34, hole.r * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        if (lctx && t >= WARP.tunnelStart - 0.1) {
          drawTunnel(lctx, w, h, { x: hole.x, y: hole.y }, t, dpr);
          ctx.save();
          ctx.beginPath();
          ctx.arc(hole.x, hole.y, Math.max(0, hole.r * 0.985), 0, Math.PI * 2);
          ctx.clip();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(layer, 0, 0);
          ctx.restore();
        }
      }
      if (flash.radius > 0) {
        // The flash: light from the centre of the hole to the whole screen, the page colour.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const r = Math.max(1, flash.radius * Math.hypot(w, h) * 0.6);
        const g = ctx.createRadialGradient(center.x, center.y, r * 0.55, center.x, center.y, r);
        g.addColorStop(0, INK);
        g.addColorStop(1, "rgba(247, 249, 252, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = flash.radius >= 1 ? INK : g;
        ctx.fillRect(0, 0, w, h);
      }
      if (t >= WARP.flash && !flashed) {
        flashed = true;
        callbacks.current.onFlash();
      }
      if (t >= WARP.flashEnd && camera) camera.style.visibility = "hidden";
      if (screen) screen.style.opacity = String(flash.screenOpacity);
      if (t >= WARP.end) {
        callbacks.current.onDone();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      clock.stop(0.3);
    };
  }, [start, camera, screen]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-gate-warp=""
      style={{ position: "absolute", left: 0, top: 0, width: "100vw", height: "100dvh", zIndex: 2, pointerEvents: "none" }}
    />
  );
}
