"use client";

import { useEffect, useRef } from "react";
import type { GateClock } from "./gate-sound";
import { WARP, blackoutAt, cameraAt, flashAt, zoomLevels, type Point } from "./gate-warp-timeline";
import { drawRabbit, type RabbitVector } from "./rabbit-vector";

/**
 * The entry warp after the click (timeline: gate-warp-timeline.ts, sound: gate-sound.ts). The camera
 * is a CSS transform on the gate's own content (rain, prompt, rabbit): it zooms into the rabbit's
 * eye and on into the black pixel of the pupil until the screen is black. This canvas only adds the
 * solid black at the end of the zoom and the light flash that reveals the page. Driven by the
 * sound's clock, written straight to the DOM per frame (no React state). A click or key press skips
 * to the flash.
 */

export type WarpStart = {
  /** The pupil's black core on screen (CSS px) when the click happened. */
  pupil: Point & { r: number };
  clock: GateClock;
  /**
   * The vector rabbit and its square on screen: drawn on the canvas at the camera scale, so the eye
   * stays sharp at any zoom. Without it the bitmap in the DOM is scaled (soft at the end).
   */
  vector?: { data: RabbitVector; box: { left: number; top: number; edge: number } } | null;
};

const LIGHT = "#f7f9fc";
const BLACK = "#000000";
const MAX_DPR = 1.5;

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
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let w = 0;
    let h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // The visible viewport (the gate screen itself may be taller under a phone's bottom bar).
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    size();
    window.addEventListener("resize", size);

    const { pupil, clock, vector } = start;
    const center = { x: w / 2, y: h / 2 };
    const zoom = zoomLevels(pupil.r, { width: w, height: h });
    if (screen) screen.style.transition = "none";
    if (camera) {
      camera.style.transformOrigin = "0 0";
      camera.style.willChange = "transform";
    }

    // The vector rabbit replaces the bitmap: the <img> is hidden in the frame that first draws it.
    const rabbitImg = vector ? camera?.querySelector<HTMLElement>("[data-gate-enter] img") ?? null : null;

    let skipBy = 0;
    const skip = () => {
      const t = clock.now() + skipBy;
      if (t < WARP.flash - 0.3) {
        skipBy += WARP.flash - 0.3 - t;
        clock.stop(0.3);
      }
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);

    let flashed = false;
    let raf = 0;
    const frame = () => {
      const t = clock.now() + skipBy;
      const cam = cameraAt(t, pupil, center, zoom);
      if (camera) {
        camera.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`;
        camera.style.setProperty("--warp-text", String(cam.textOpacity));
        // Once the screen is black the huge layer is not needed any more.
        camera.style.visibility = t >= WARP.blackAt ? "hidden" : "";
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (vector && t < WARP.blackAt) {
        drawRabbit(ctx, vector.data, vector.box, cam, dpr);
        if (rabbitImg) rabbitImg.style.visibility = "hidden";
      }
      const black = blackoutAt(t);
      if (black > 0) {
        ctx.globalAlpha = black;
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, w, h);
      }
      const flash = flashAt(t);
      if (flash.radius > 0) {
        // The flash: light from the centre to the whole screen, the page colour.
        const r = Math.max(1, flash.radius * Math.hypot(w, h) * 0.6);
        const g = ctx.createRadialGradient(center.x, center.y, r * 0.5, center.x, center.y, r);
        g.addColorStop(0, LIGHT);
        g.addColorStop(1, "rgba(247, 249, 252, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = flash.radius >= 1 ? LIGHT : g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      if (t >= WARP.flash && !flashed) {
        flashed = true;
        callbacks.current.onFlash();
      }
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
      if (rabbitImg) rabbitImg.style.visibility = "";
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
