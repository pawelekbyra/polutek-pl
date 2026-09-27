"use client";

import { useEffect, useRef } from "react";

const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
  "0123456789ABCDEF";
const FONT_SIZE = 12;
const COL_W = 13;
// Rows advanced per frame at 60 fps — tune this to change rain speed.
const SPEED = 0.45;

/**
 * Full-screen Matrix-style rain: katakana + hex digits, dark chars on the
 * site's light background (inverse of the classic green-on-black).
 * Runs at full RAF speed (60 fps) with fractional row positions so the
 * motion is perfectly smooth. Respects prefers-reduced-motion.
 */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BG = "#f7f9fc";
    let columns: number[] = [];
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cols = Math.floor(canvas.width / COL_W);
      const rows = canvas.height / FONT_SIZE;
      // Spread across the entire visible height from frame 1.
      columns = Array.from({ length: cols }, () => Math.random() * rows);
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { width: w, height: h } = canvas;

      // Fade to background — alpha controls trail length.
      ctx.fillStyle = "rgba(247, 249, 252, 0.12)";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.fillStyle = "rgba(17, 24, 39, 0.88)";

      for (let i = 0; i < columns.length; i++) {
        columns[i] += SPEED;
        const y = columns[i] * FONT_SIZE;
        // Draw as long as the head is within (or just about to enter) the canvas.
        if (y >= 0 && y < h + FONT_SIZE) {
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, y);
        }
        // Reset immediately once off-screen; tiny stagger keeps columns out of sync.
        if (y > h) {
          columns[i] = -(Math.random() * 4);
        }
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
