/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GATE_BOOT_SCRIPT,
  RAIN_CONFIG,
  cellAlpha,
  createRainState,
  resizeRainState,
  stepRain,
} from "@/app/components/preload/matrix-rain-engine";

// Deterministic PRNG (mulberry32) so the assertions do not depend on Math.random.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLS = 120;
const ROWS = 80;

function litCells(state: ReturnType<typeof createRainState>) {
  let lit = 0;
  for (let c = 0; c < state.cols; c++) {
    for (let r = 0; r < state.rows; r++) {
      if (cellAlpha(state.heads[c] - r, RAIN_CONFIG) > RAIN_CONFIG.dim + 0.05) lit++;
    }
  }
  return lit;
}

describe("matrix rain state", () => {
  it("starts in its steady state: heads spread over the whole cycle, trails on the first frame", () => {
    const state = createRainState(COLS, ROWS, RAIN_CONFIG, seeded(1));
    const cycle = ROWS + RAIN_CONFIG.trail;
    const heads = Array.from(state.heads);
    expect(Math.min(...heads)).toBeLessThan(cycle * 0.1);
    expect(Math.max(...heads)).toBeGreaterThan(cycle * 0.9);
    // Every quarter of the cycle holds a share of the columns (no "all at the top" start).
    for (let q = 0; q < 4; q++) {
      const inQuarter = heads.filter((h) => h >= (q * cycle) / 4 && h < ((q + 1) * cycle) / 4).length;
      expect(inQuarter).toBeGreaterThan(COLS / 8);
    }

    // The first frame already looks like the rain after a long run.
    const first = litCells(state);
    const longRun = createRainState(COLS, ROWS, RAIN_CONFIG, seeded(1));
    const random = seeded(2);
    for (let i = 0; i < 600; i++) stepRain(longRun, 1 / 60, RAIN_CONFIG, random);
    const later = litCells(longRun);
    expect(first).toBeGreaterThan(COLS * 10);
    expect(Math.abs(first - later) / later).toBeLessThan(0.25);
  });

  it("falls at constant speed from the first step (no ramp) and independent of the frame rate", () => {
    const cycle = ROWS + RAIN_CONFIG.trail;
    const state = createRainState(COLS, ROWS, RAIN_CONFIG, seeded(3));
    for (let c = 0; c < COLS; c++) state.heads[c] = 0;
    const speeds = Array.from(state.speeds);
    const random = seeded(4);

    stepRain(state, 1 / 60, RAIN_CONFIG, random);
    const firstStep = Array.from(state.heads);
    for (let i = 1; i < 50; i++) stepRain(state, 1 / 60, RAIN_CONFIG, random);
    const before = Array.from(state.heads);
    stepRain(state, 1 / 60, RAIN_CONFIG, random);
    for (let c = 0; c < COLS; c++) {
      expect(firstStep[c]).toBeCloseTo(speeds[c] / 60, 9);
      const later = (state.heads[c] - before[c] + cycle) % cycle;
      expect(later).toBeCloseTo(firstStep[c], 9);
    }

    // Two half frames move exactly as far as one full frame.
    const a = createRainState(COLS, ROWS, RAIN_CONFIG, seeded(5));
    const b = createRainState(COLS, ROWS, RAIN_CONFIG, seeded(5));
    stepRain(a, 1 / 60, RAIN_CONFIG, seeded(6));
    stepRain(b, 1 / 120, RAIN_CONFIG, seeded(6));
    stepRain(b, 1 / 120, RAIN_CONFIG, seeded(7));
    for (let c = 0; c < COLS; c++) expect(b.heads[c]).toBeCloseTo(a.heads[c], 9);
  });

  it("uses the speed the rain always had (0.45 rows per 60 Hz frame on average)", () => {
    const state = createRainState(400, ROWS, RAIN_CONFIG, seeded(8));
    const mean = Array.from(state.speeds).reduce((sum, s) => sum + s, 0) / state.cols;
    expect(mean / 60).toBeGreaterThan(0.42);
    expect(mean / 60).toBeLessThan(0.48);
  });

  it("keeps existing columns in place on resize", () => {
    const state = createRainState(10, 20, RAIN_CONFIG, seeded(9));
    const resized = resizeRainState(state, 12, 30, RAIN_CONFIG, seeded(10));
    expect(resized.cols).toBe(12);
    for (let c = 0; c < 10; c++) {
      expect(resized.heads[c]).toBe(state.heads[c]);
      expect(resized.speeds[c]).toBe(state.speeds[c]);
      expect(resized.grid[c * 30 + 5]).toBe(state.grid[c * 20 + 5]);
    }
  });
});

describe("gate boot script", () => {
  afterEach(() => {
    sessionStorage.clear();
    document.documentElement.removeAttribute("data-gate-passed");
    const w = window as unknown as Record<string, unknown>;
    delete w.__ppRain;
    delete w.__ppGateQueued;
    document.body.innerHTML = "";
  });

  const run = () => new Function(GATE_BOOT_SCRIPT)();

  it("hides the gate before the first paint for a viewer who already entered in this tab", () => {
    sessionStorage.setItem("polutek:revealed", "1");
    run();
    expect(document.documentElement.hasAttribute("data-gate-passed")).toBe(true);
    expect((window as unknown as Record<string, unknown>).__ppRain).toBeUndefined();
  });

  it("installs the rain runtime, draws parsed canvases and remembers an early click", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    run();
    const runtime = (window as unknown as Record<string, { attach: unknown }>).__ppRain;
    expect(typeof runtime.attach).toBe("function");
    expect(document.documentElement.hasAttribute("data-gate-passed")).toBe(false);

    document.body.innerHTML =
      '<div><canvas data-matrix-rain></canvas><button type="button" data-gate-enter><span>ŁADOWANIE</span></button></div>';
    await Promise.resolve();
    // The observer handed the parsed canvas to the runtime, which sized it for the viewport.
    const canvas = document.querySelector("canvas")!;
    expect(canvas.width).toBe(Math.round(window.innerWidth));

    document.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect((window as unknown as Record<string, unknown>).__ppGateQueued).toBe(true);
    expect(document.querySelector("button")!.hasAttribute("data-queued")).toBe(true);
    vi.restoreAllMocks();
  });
});
