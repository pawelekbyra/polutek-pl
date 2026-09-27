"use client";

import { useEffect, useRef } from "react";

const FONT_SIZE = 14;
const COL_W = 16;
const BASE_SPEED = 0.5;   // rows/frame at 60 fps (base; each column varies ±25%)
const TRAIL_ROWS = 28;    // bright-trail length in grid rows
const BASE_ALPHA = 0.14;  // minimum opacity — keeps entire screen filled
const HEAD_ALPHA = 0.86;  // peak extra opacity added at the head

/**
 * Binary Matrix rain: 0/1 characters, dark on the site's light background.
 * Every column always has characters visible (BASE_ALPHA fill), with a
 * bright falling trail moving continuously from top to bottom — no gaps,
 * no teleporting, no stutter. Full RAF at 60fps.
 */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    let heads: number[] = [];
    let speeds: number[] = [];
    let grid: Uint8Array[] = [];
    let raf: number;

    const setup = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / COL_W);
      rows = Math.ceil(canvas.height / FONT_SIZE) + 2;

      // Spread heads across the whole height so the screen is full from frame 1.
      heads = Array.from({ length: cols }, () => Math.random() * rows);
      // Slightly different speed per column for organic variety.
      speeds = Array.from(
        { length: cols },
        () => BASE_SPEED * (0.75 + Math.random() * 0.5),
      );
      grid = Array.from({ length: cols }, () => {
        const arr = new Uint8Array(rows);
        for (let r = 0; r < rows; r++) arr[r] = Math.round(Math.random());
        return arr;
      });
    };

    setup();
    window.addEventListener("resize", setup);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#f7f9fc";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `bold ${FONT_SIZE}px monospace`;
      ctx.fillStyle = "#111827";

      for (let c = 0; c < cols; c++) {
        // Advance head; wrap immediately at bottom — no pause, no gap.
        heads[c] += speeds[c];
        if (heads[c] > rows + 1) heads[c] = 0;

        // Randomly flip a bit per column for the classic "changing digit" feel.
        if (Math.random() < 0.2) {
          grid[c][Math.floor(Math.random() * rows)] ^= 1;
        }

        const hd = heads[c];

        for (let r = 0; r < rows; r++) {
          const y = r * FONT_SIZE;
          if (y > h + FONT_SIZE) break;

          const dist = hd - r; // positive = r is behind the head
          let alpha: number;

          if (dist >= 0 && dist <= TRAIL_ROWS) {
            // Bright at head (dist=0), linearly fades to BASE_ALPHA at trail end.
            alpha = BASE_ALPHA + HEAD_ALPHA * (1 - dist / TRAIL_ROWS);
          } else {
            alpha = BASE_ALPHA;
          }

          ctx.globalAlpha = alpha;
          ctx.fillText(grid[c][r] === 0 ? "0" : "1", c * COL_W, y);
        }
      }

      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setup);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
