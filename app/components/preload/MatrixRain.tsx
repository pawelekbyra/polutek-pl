"use client";

import { useEffect, useRef } from "react";

const CHARS =
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ" +
  "0123456789";

const FONT_SIZE = 13;
const COL_W = 14;
const BASE_SPEED = 0.45;
const TRAIL = 26;
const DIM = 0.08;
const BRIGHT = 0.65;
// Drain: reveal line sweeps downward at this speed (px/s).
// ~450 px/s means a ~2s wipe on a 900px-tall screen — a gentle, natural pace.
const REVEAL_PX_PER_S = 450;
// Soft gradient zone at the leading edge of the sweep (px).
const GRAD_H = 160;

// Module-level snapshot — survives the loading.tsx → PageRevealGate remount
// so the second instance continues exactly where the first left off.
let snap: {
  cols: number;
  rows: number;
  heads: Float64Array;
  speeds: Float64Array;
  grid: Uint8Array[];
} | null = null;

interface MatrixRainProps {
  /** When true the rain drains off the bottom, revealing the page from the top. */
  leaving?: boolean;
}

export function MatrixRain({ leaving = false }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leavingRef = useRef(leaving);

  useEffect(() => {
    leavingRef.current = leaving;
  }, [leaving]);

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
    // Timestamp when leaving first became true (initialised inside tick).
    let leaveStartMs = -1;

    const setup = (isResize = false) => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const newCols = Math.floor(canvas.width / COL_W);
      const newRows = Math.ceil(canvas.height / FONT_SIZE) + 2;

      if (!isResize && snap && snap.cols === newCols && snap.rows === newRows) {
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

      // ── Normal rain ──────────────────────────────────────────────────────────
      ctx.fillStyle = "#f7f9fc";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.fillStyle = "#111827";

      for (let c = 0; c < cols; c++) {
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
            dist >= 0 && dist <= TRAIL ? DIM + BRIGHT * (1 - dist / TRAIL) : DIM;
          ctx.globalAlpha = alpha;
          ctx.fillText(CHARS[grid[c][r]], c * COL_W, y);
        }
      }
      ctx.globalAlpha = 1;

      // ── Drain wipe (applied on top of normal rain) ───────────────────────────
      // When leaving, erase the canvas from the top downward using destination-out
      // compositing. The rain beneath is drawn normally; the wipe erases it above
      // the sweep line. A gradient zone at the leading edge softens the boundary.
      if (leavingRef.current) {
        if (leaveStartMs < 0) leaveStartMs = performance.now();
        const elapsed = (performance.now() - leaveStartMs) / 1000;
        // clearLine: how many px from the top have been revealed so far.
        const clearLine = elapsed * REVEAL_PX_PER_S;

        if (clearLine >= h + GRAD_H) {
          // Entire canvas is now transparent — done.
          ctx.clearRect(0, 0, w, h);
          cancelAnimationFrame(raf);
          return;
        }

        ctx.globalCompositeOperation = "destination-out";

        // Solid erase above the gradient zone.
        const gradTop = Math.max(0, clearLine - GRAD_H);
        if (gradTop > 0) {
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(0, 0, w, gradTop);
        }

        // Gradient erase: from fully transparent (top) to not-erased (bottom).
        if (clearLine > gradTop) {
          const grad = ctx.createLinearGradient(0, gradTop, 0, clearLine);
          grad.addColorStop(0, "rgba(0,0,0,1)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, gradTop, w, clearLine - gradTop);
        }

        ctx.globalCompositeOperation = "source-over";
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
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
