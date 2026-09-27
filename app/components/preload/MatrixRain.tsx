"use client";

import { useEffect, useRef } from "react";

const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
  "0123456789ABCDEF";
const FONT_SIZE = 14;
const FPS = 20;
const INTERVAL = 1000 / FPS;

/**
 * Full-screen Matrix-style rain: katakana + hex digits, dark chars on the
 * site's light background (inverse of the classic green-on-black).
 * Client-only; respects prefers-reduced-motion.
 */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let columns: number[] = [];
    let raf: number;
    let last = 0;

    const BG = "#f7f9fc";

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cols = Math.floor(canvas.width / FONT_SIZE);
      columns = Array.from(
        { length: cols },
        () => -Math.floor(Math.random() * (canvas.height / FONT_SIZE)),
      );
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - last < INTERVAL) return;
      last = ts;

      const { width: w, height: h } = canvas;

      // Fade towards background — controls trail length
      ctx.fillStyle = "rgba(247, 249, 252, 0.1)";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.fillStyle = "rgba(17, 24, 39, 0.82)";

      for (let i = 0; i < columns.length; i++) {
        const y = columns[i] * FONT_SIZE;
        if (y > 0 && y < h + FONT_SIZE) {
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT_SIZE, y);
        }
        if (y > h && Math.random() > 0.975) columns[i] = 0;
        columns[i]++;
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
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
