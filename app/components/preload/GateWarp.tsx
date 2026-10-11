"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { GateClock } from "./gate-sound";
import { WARP, blackoutAt, cameraAt, flashAt, zoomLevels, type Point } from "./gate-warp-timeline";
import { drawRabbit, type RabbitVector } from "./rabbit-vector";
import { drawTunnelWindow, drawVoid } from "./gate-void";
import { drawButton, drawPrompt, type CapturedButton, type CapturedPrompt } from "./gate-scene";
import { ensureRainRuntime } from "./matrix-rain-engine";

/**
 * The entry warp after the click (timeline: gate-warp-timeline.ts, sound: gate-sound.ts). The camera
 * is a CSS transform on the gate's own content (rain, prompt, rabbit): it zooms into the rabbit's
 * eye and on into the black pixel of the pupil until the screen is black. This canvas only adds the
 * solid black at the end of the zoom and the light flash that reveals the page. Driven by the
 * sound's clock, written straight to the DOM per frame (no React state). The first frame is drawn in
 * the same commit as the click (layout effect), so the zoom starts with no visible delay. A click or
 * key press after the first 0.6 s skips to the flash (not the tap that entered, not a held key).
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
  /** The ENTER button, drawn on the canvas under the same camera (it stays and zooms with the rabbit). */
  button?: CapturedButton | null;
  /** "Follow the white rabbit", likewise part of the zooming scene. */
  prompt?: CapturedPrompt | null;
};

const LIGHT = "#f7f9fc";
const BLACK = "#000000";
const MAX_DPR = 1.5;

export function GateWarp({
  start,
  camera,
  screen,
  onReveal,
  onDone,
}: {
  start: WarpStart;
  /** The gate content the camera moves (rain + prompt + rabbit). */
  camera: HTMLElement | null;
  /** The gate screen itself (faded out at the end). */
  screen: HTMLElement | null;
  /** The flash covers the screen: the page shows through from now on (the hero starts here). */
  onReveal: () => void;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onReveal, onDone });
  useEffect(() => {
    callbacks.current = { onReveal, onDone };
  }, [onReveal, onDone]);

  // Layout effect: the first frame is on screen in the very paint that follows the click.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      callbacks.current.onReveal();
      callbacks.current.onDone();
      return;
    }
    const { pupil, clock, vector, button, prompt } = start;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let w = 0;
    let h = 0;
    let center = { x: 0, y: 0 };
    let zoom = { eye: 1, black: 1 };
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // The visible viewport (the gate screen itself may be taller under a phone's bottom bar).
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // A rotation or a browser bar that moves mid-warp re-aims the camera at the new centre.
      center = { x: w / 2, y: h / 2 };
      zoom = zoomLevels(pupil.r, { width: w, height: h });
    };
    size();
    window.addEventListener("resize", size);
    // The focused ENTER button is about to be hidden from assistive tech (aria-hidden screen).
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (screen) screen.style.transition = "none";
    if (camera) {
      camera.style.transformOrigin = "0 0";
      camera.style.willChange = "transform";
    }

    // The vector rabbit replaces the bitmap: the <img> is hidden in the frame that first draws it.
    const rabbitImg = vector ? camera?.querySelector<HTMLElement>("[data-gate-rabbit] img") ?? null : null;
    // Same for the ENTER button: from the first frame on it is the canvas copy that zooms.
    const buttonEl = button ? camera?.querySelector<HTMLElement>("[data-gate-enter]") ?? null : null;
    const promptEl = prompt ? camera?.querySelector<HTMLElement>("[data-gate-prompt]") ?? null : null;

    let skipBy = 0;
    const skip = (event: Event) => {
      // Not the tap that entered (its pointer events may still arrive), not a held key (repeats).
      if (event instanceof KeyboardEvent && event.repeat) return;
      const t = clock.now() + skipBy;
      if (t < 0.6) return;
      if (t < WARP.flash - 0.3) {
        skipBy += WARP.flash - 0.3 - t;
        clock.stop(0.3);
      }
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);

    // The rain is invisible once the screen is black: stop its loop instead of drawing it unseen.
    const rainCanvas = camera?.querySelector<HTMLCanvasElement>("canvas[data-matrix-rain]") ?? null;
    let rainStopped = false;

    let revealed = false;
    let raf = 0;
    const frame = () => {
      const t = clock.now() + skipBy;
      const cam = cameraAt(t, pupil, center, zoom);
      if (camera) {
        camera.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`;
        // Once the screen is black the huge layer is not needed any more.
        camera.style.visibility = t >= WARP.blackAt ? "hidden" : "";
      }
      if (t >= WARP.blackAt && rainCanvas && !rainStopped) {
        rainStopped = true;
        ensureRainRuntime().detach(rainCanvas);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (vector && t < WARP.blackAt) {
        drawRabbit(ctx, vector.data, vector.box, cam, dpr);
        if (rabbitImg) rabbitImg.style.visibility = "hidden";
      }
      if (prompt && t < WARP.blackAt) {
        drawPrompt(ctx, prompt, cam, dpr, t);
        if (promptEl) promptEl.style.visibility = "hidden";
      }
      if (button && t < WARP.blackAt) {
        drawButton(ctx, button, cam, dpr);
        if (buttonEl) buttonEl.style.visibility = "hidden";
      }
      const black = blackoutAt(t);
      if (black > 0) {
        ctx.globalAlpha = black;
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, w, h);
      }
      // Before the camera is inside the pupil, the tunnel is seen through it (its black core is a window).
      if (t < WARP.blackAt) {
        drawTunnelWindow(ctx, { width: w, height: h }, t, {
          x: cam.tx + cam.scale * pupil.x,
          y: cam.ty + cam.scale * pupil.y,
          r: cam.scale * pupil.r,
        });
      }
      // The void runs on under the flash (its title flies through the camera into it).
      if (t >= WARP.blackAt && t < WARP.flashEnd) {
        drawVoid(ctx, { width: w, height: h }, t, (t - WARP.blackAt) / (WARP.flash - WARP.blackAt));
        ctx.globalAlpha = 1;
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
      if (t >= WARP.flashEnd && !revealed) {
        revealed = true;
        callbacks.current.onReveal();
      }
      if (screen) screen.style.opacity = String(flash.screenOpacity);
      if (t >= WARP.end) {
        callbacks.current.onDone();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      if (rabbitImg) rabbitImg.style.visibility = "";
      if (buttonEl) buttonEl.style.visibility = "";
      if (promptEl) promptEl.style.visibility = "";
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
