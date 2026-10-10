"use client";

import { useLayoutEffect, useRef } from "react";
import { ensureRainRuntime } from "./matrix-rain-engine";

/**
 * The gate's rain canvas. The drawing lives in `matrix-rain-engine.ts`: the `<head>` boot script
 * has usually drawn this very canvas before hydration, so this only (re)attaches the one running
 * rain to it and stops the loop when the canvas goes away (no CPU after the gate).
 */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Layout effect: a canvas created on the client is drawn before the browser paints it, so
  // the loading.tsx → PageRevealGate hand-over never shows an empty frame.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = ensureRainRuntime();
    runtime.attach(canvas);
    // The phone's browser bars take their colour from <meta name="theme-color">: dark while the gate is up.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", "#020604");
    return () => {
      runtime.detach(canvas);
      if (meta && previous !== null) meta.setAttribute("content", previous);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-matrix-rain=""
      aria-hidden="true"
      // The boot script sizes the canvas before hydration (width/height attributes).
      suppressHydrationWarning
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
