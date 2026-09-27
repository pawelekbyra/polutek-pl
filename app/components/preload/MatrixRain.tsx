"use client";

import { useEffect, useRef } from "react";

// Half-width katakana (U+FF65–FF9F) — same width as ASCII in monospace,
// so columns stay aligned. Matches the classic Matrix aesthetic.
const CHARS =
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ" +
  "0123456789";

const FONT_SIZE = 13;
const COL_W = 14;
const BASE_SPEED = 0.45;
const TRAIL = 26;
const DIM = 0.08;
const BRIGHT = 0.65;

// Module-level snapshot: survives the loading.tsx → PageRevealGate remount so the
// second instance continues exactly where the first left off (no frame jump).
let snap: {
  cols: number;
  rows: number;
  heads: Float64Array;
  speeds: Float64Array;
  grid: Uint8Array[];
} | null = null;

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
    let heads: Float64Array = new Float64Array(0);
    let speeds: Float64Array = new Float64Array(0);
    let grid: Uint8Array[] = [];
    let raf: number;

    const setup = (isResize = false) => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const newCols = Math.floor(canvas.width / COL_W);
      const newRows = Math.ceil(canvas.height / FONT_SIZE) + 2;

      // On the initial mount (not a resize), restore the saved snapshot if dimensions match —
      // this makes the second mount (PageRevealGate) continue where loading.tsx left off.
      if (
        !isResize &&
        snap &&
        snap.cols === newCols &&
        snap.rows === newRows
      ) {
        cols = newCols;
        rows = newRows;
        heads = snap.heads.slice();
        speeds = snap.speeds.slice();
        grid = snap.grid.map((col) => col.slice() as Uint8Array);
        return;
      }

      cols = newCols;
      rows = newRows;
      heads = new Float64Array(cols);
      speeds = new Float64Array(cols);
      grid = [];
      for (let c = 0; c < cols; c++) {
        heads[c] = Math.random() * rows;
        speeds[c] = BASE_SPEED * (0.75 + Math.random() * 0.5);
        const arr = new Uint8Array(rows);
        for (let r = 0; r < rows; r++) arr[r] = Math.floor(Math.random() * CHARS.length);
        grid.push(arr);
      }
    };

    setup(false);

    const handleResize = () => setup(true);
    window.addEventListener("resize", handleResize);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#f7f9fc";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.fillStyle = "#111827";

      for (let c = 0; c < cols; c++) {
        // Modular wrap over rows+TRAIL: tail fades off-screen before head re-enters.
        heads[c] = (heads[c] + speeds[c]) % (rows + TRAIL);

        if (Math.random() < 0.12) {
          const r = Math.floor(Math.random() * rows);
          grid[c][r] = Math.floor(Math.random() * CHARS.length);
        }

        const hd = heads[c];
        for (let r = 0; r < rows; r++) {
          const y = r * FONT_SIZE;
          if (y > h + FONT_SIZE) break;

          const dist = hd - r;
          const alpha =
            dist >= 0 && dist <= TRAIL
              ? DIM + BRIGHT * (1 - dist / TRAIL)
              : DIM;

          ctx.globalAlpha = alpha;
          ctx.fillText(CHARS[grid[c][r]], c * COL_W, y);
        }
      }

      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      // Save state so the next mount (if any) can continue seamlessly.
      snap = { cols, rows, heads: heads.slice(), speeds: speeds.slice(), grid };
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
