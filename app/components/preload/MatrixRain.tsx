"use client";

import { useEffect, useRef } from "react";

// Half-width katakana (U+FF65–FF9F) — same width as ASCII in monospace,
// so columns stay aligned. Matches the classic Matrix aesthetic.
const CHARS =
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ" +
  "0123456789";

const FONT_SIZE = 13;
const COL_W = 14;
const BASE_SPEED = 0.45;  // rows/frame at 60 fps; each column ±25%
const TRAIL = 26;          // bright-trail length in rows
const DIM = 0.08;          // opacity of background fill (always-visible coverage)
const BRIGHT = 0.65;       // peak extra opacity added at the trail head

/**
 * Matrix-style falling characters: half-width katakana + digits on the
 * site's light background (inverse colour scheme).
 *
 * Rendering model: each column runs a cyclic head from 0 to (rows+TRAIL),
 * then wraps modularly. This means the trail at the bottom fades out
 * naturally over TRAIL rows BEFORE the head reappears at the top —
 * zero flicker, zero sudden-frame discontinuity.
 *
 * Every cell is always drawn at DIM opacity so the whole screen stays
 * filled. The bright trail rides on top.
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
    // Fractional row position of each column's head.
    let heads: number[] = [];
    // Per-column speed multiplier for organic variety.
    let speeds: number[] = [];
    // Character index (into CHARS) for each grid cell.
    let grid: Uint8Array[] = [];
    let raf: number;

    const setup = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / COL_W);
      rows = Math.ceil(canvas.height / FONT_SIZE) + 2;

      // Scatter heads across [0, rows] so the screen is full from frame 1.
      heads = Array.from({ length: cols }, () => Math.random() * rows);
      speeds = Array.from(
        { length: cols },
        () => BASE_SPEED * (0.75 + Math.random() * 0.5),
      );
      grid = Array.from({ length: cols }, () => {
        const arr = new Uint8Array(rows);
        for (let r = 0; r < rows; r++) {
          arr[r] = Math.floor(Math.random() * CHARS.length);
        }
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

      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.fillStyle = "#111827";

      for (let c = 0; c < cols; c++) {
        // Modular wrap over rows+TRAIL: the tail fades out off-screen before
        // the head re-enters from the top → no sudden brightness jump.
        heads[c] = (heads[c] + speeds[c]) % (rows + TRAIL);

        // Occasionally swap one character in this column for the "changing
        // digits" flicker effect.
        if (Math.random() < 0.12) {
          const r = Math.floor(Math.random() * rows);
          grid[c][r] = Math.floor(Math.random() * CHARS.length);
        }

        const hd = heads[c];

        for (let r = 0; r < rows; r++) {
          const y = r * FONT_SIZE;
          if (y > h + FONT_SIZE) break;

          const dist = hd - r; // positive → r is behind the head
          let alpha: number;

          if (dist >= 0 && dist <= TRAIL) {
            // Linear fade: full brightness at head, down to DIM at trail end.
            alpha = DIM + BRIGHT * (1 - dist / TRAIL);
          } else {
            alpha = DIM;
          }

          ctx.globalAlpha = alpha;
          ctx.fillText(CHARS[grid[c][r]], c * COL_W, y);
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
