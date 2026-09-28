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

// Module-level snapshot — survives the loading.tsx → PageRevealGate remount
// so the second instance continues exactly where the first left off.
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

    const setup = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const newCols = Math.floor(canvas.width / COL_W);
      const newRows = Math.ceil(canvas.height / FONT_SIZE) + 2;

      if (snap && snap.cols === newCols && snap.rows === newRows) {
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

    // Resize: keep existing column positions — only adjust for new dimensions.
    // A full re-randomize would flash all heads to new random positions.
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const newCols = Math.floor(canvas.width / COL_W);
      const newRows = Math.ceil(canvas.height / FONT_SIZE) + 2;

      if (newCols === cols && newRows === rows) return;

      if (newCols !== cols) {
        const newHeads = new Float64Array(newCols);
        const newSpeeds = new Float64Array(newCols);
        const copyLen = Math.min(cols, newCols);
        newHeads.set(heads.subarray(0, copyLen));
        newSpeeds.set(speeds.subarray(0, copyLen));
        for (let c = copyLen; c < newCols; c++) {
          // Start new columns off-screen so they enter naturally from the top.
          newHeads[c] = newRows + Math.random() * TRAIL;
          newSpeeds[c] = BASE_SPEED * (0.75 + Math.random() * 0.5);
        }
        heads = newHeads;
        speeds = newSpeeds;
        while (grid.length < newCols) {
          const arr = new Uint8Array(newRows);
          for (let r = 0; r < newRows; r++) arr[r] = Math.floor(Math.random() * CHARS.length);
          grid.push(arr);
        }
        grid.length = newCols;
      }

      if (newRows > rows) {
        for (let c = 0; c < cols; c++) {
          const newArr = new Uint8Array(newRows);
          newArr.set(grid[c]);
          for (let r = grid[c].length; r < newRows; r++) {
            newArr[r] = Math.floor(Math.random() * CHARS.length);
          }
          grid[c] = newArr;
        }
      }

      cols = newCols;
      rows = newRows;
    };

    window.addEventListener("resize", handleResize);

    const drawFrame = () => {
      const w = canvas.width;
      const h = canvas.height;

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
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      drawFrame();
    };

    setup();
    // Draw one frame immediately so the canvas is never blank between mount and
    // the first RAF callback — prevents a single white/transparent flash.
    drawFrame();
    // Fade the canvas in after the first frame is ready so it doesn't pop in
    // abruptly over the CSS scanlines that were already running.
    requestAnimationFrame(() => { canvas.style.opacity = "1"; });
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
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0,
        transition: "opacity 600ms ease-in",
        zIndex: 1,
      }}
    />
  );
}
