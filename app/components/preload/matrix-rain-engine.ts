/**
 * Matrix rain of the entry gate: pure state functions plus a tiny canvas runtime.
 *
 * The same code runs in two places:
 * - as an inline `<script>` in the root layout's `<head>` (see {@link GATE_BOOT_SCRIPT}), so the
 *   rain is drawn and moving from the first painted frame, before React has hydrated;
 * - from `MatrixRain` after hydration, which only hands its canvas to the runtime the boot
 *   script already started (or starts it, e.g. in tests or when the script did not run).
 *
 * Because the boot script is built with `Function.prototype.toString`, every function below
 * that ends up in it must be self-contained: it may only use its parameters and locals (no
 * imports, no module constants, no spread/destructuring/for-of that a compiler could turn into
 * helper calls). Configuration travels as the plain `cfg` object.
 */

export interface RainConfig {
  /** Glyph size and row height, CSS px. */
  fontSize: number;
  /** Column width, CSS px. */
  colWidth: number;
  /** Average fall speed, rows per second (time-based, independent of the frame rate). */
  speedRowsPerSec: number;
  /** Length of the bright trail behind a head, rows. */
  trail: number;
  /** Alpha of every resting glyph. */
  dim: number;
  /** Extra alpha at a head. */
  bright: number;
  /** Chance per column per 1/60 s that one glyph changes. */
  mutatePerTick: number;
  /** Frame cap (fps). */
  maxFps: number;
  /** Upper bound for the canvas backing-store scale. */
  maxDpr: number;
  background: string;
  ink: string;
  chars: string;
  /** Global names shared by the boot script and the React side. */
  runtimeGlobal: string;
  queueGlobal: string;
  sessionKey: string;
  passedAttribute: string;
  canvasSelector: string;
  enterSelector: string;
}

export const RAIN_CONFIG: RainConfig = {
  fontSize: 13,
  colWidth: 14,
  // 0.45 rows per frame at 60 Hz: the speed the rain always had, now in wall-clock time.
  speedRowsPerSec: 27,
  trail: 26,
  dim: 0.08,
  bright: 0.85,
  mutatePerTick: 0.12,
  maxFps: 60,
  maxDpr: 2,
  background: "#020604",
  ink: "#2bff6a",
  chars:
    "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789",
  runtimeGlobal: "__ppRain",
  queueGlobal: "__ppGateQueued",
  sessionKey: "polutek:revealed",
  passedAttribute: "data-gate-passed",
  canvasSelector: "canvas[data-matrix-rain]",
  enterSelector: "[data-gate-enter]",
};

export interface RainState {
  cols: number;
  rows: number;
  /** Head position per column, in rows; cycles over [0, rows + trail). */
  heads: Float64Array;
  /** Fall speed per column, rows per second. */
  speeds: Float64Array;
  /** Glyph index per cell, column-major (`c * rows + r`). */
  grid: Uint8Array;
  /** Cells whose glyph changed since the last draw (consumed by the renderer). */
  dirty: number[];
}

/**
 * A rain that is already in its steady state: heads are spread uniformly over the whole cycle
 * (exactly the distribution a long-running rain converges to), so the very first frame shows
 * trails all over the screen at full speed. There is no warm-up and no speed ramp.
 */
export function createRainState(cols: number, rows: number, cfg: RainConfig, random: () => number): RainState {
  var heads = new Float64Array(cols);
  var speeds = new Float64Array(cols);
  var grid = new Uint8Array(cols * rows);
  var cycle = rows + cfg.trail;
  for (var c = 0; c < cols; c++) {
    heads[c] = random() * cycle;
    speeds[c] = cfg.speedRowsPerSec * (0.75 + random() * 0.5);
  }
  for (var i = 0; i < grid.length; i++) grid[i] = Math.floor(random() * cfg.chars.length);
  return { cols: cols, rows: rows, heads: heads, speeds: speeds, grid: grid, dirty: [] };
}

/** Advances the rain by `dtSec` of wall-clock time (constant speed from the first step). */
export function stepRain(state: RainState, dtSec: number, cfg: RainConfig, random: () => number): void {
  var cycle = state.rows + cfg.trail;
  // Keep the per-second mutation rate the same at any frame rate.
  var mutate = 1 - Math.pow(1 - cfg.mutatePerTick, dtSec * 60);
  for (var c = 0; c < state.cols; c++) {
    var h = (state.heads[c] + state.speeds[c] * dtSec) % cycle;
    state.heads[c] = h < 0 ? h + cycle : h;
    if (state.rows > 0 && random() < mutate) {
      var idx = c * state.rows + Math.floor(random() * state.rows);
      state.grid[idx] = Math.floor(random() * cfg.chars.length);
      state.dirty.push(idx);
    }
  }
}

/** Fits the state to a new grid size, keeping every existing column where it was. */
export function resizeRainState(
  state: RainState,
  cols: number,
  rows: number,
  cfg: RainConfig,
  random: () => number,
): RainState {
  if (cols === state.cols && rows === state.rows) return state;
  var next = createRainState(cols, rows, cfg, random);
  var keepCols = Math.min(cols, state.cols);
  var keepRows = Math.min(rows, state.rows);
  for (var c = 0; c < keepCols; c++) {
    next.heads[c] = state.heads[c] % (rows + cfg.trail);
    next.speeds[c] = state.speeds[c];
    for (var r = 0; r < keepRows; r++) next.grid[c * rows + r] = state.grid[c * state.rows + r];
  }
  return next;
}

/** Alpha of a cell `dist` rows behind its column's head (`dist < 0`: ahead of it). */
export function cellAlpha(dist: number, cfg: RainConfig): number {
  return dist >= 0 && dist <= cfg.trail ? cfg.dim + cfg.bright * (1 - dist / cfg.trail) : cfg.dim;
}

/**
 * Installs the canvas runtime on `win[cfg.runtimeGlobal]` (once) and returns it.
 * `attach(canvas)` moves the one running rain onto that canvas and draws a full frame at once;
 * `detach(canvas)` stops the loop (the state is kept, so the next canvas continues seamlessly).
 * The loop is frame-capped, pauses in hidden tabs and draws a single still frame under
 * `prefers-reduced-motion`.
 */
export function installRainRuntime(
  win: Window & Record<string, unknown>,
  cfg: RainConfig,
  fns: {
    create: typeof createRainState;
    step: typeof stepRain;
    resize: typeof resizeRainState;
    alpha: typeof cellAlpha;
  },
) {
  var existing = win[cfg.runtimeGlobal] as
    | { attach: (canvas: HTMLCanvasElement) => void; detach: (canvas: HTMLCanvasElement) => void }
    | undefined;
  if (existing) return existing;

  var doc = win.document;
  var rand = Math.random;
  var state: RainState | null = null;
  var canvas: HTMLCanvasElement | null = null;
  var ctx: CanvasRenderingContext2D | null = null;
  var layer: HTMLCanvasElement | null = null;
  var layerCtx: CanvasRenderingContext2D | null = null;
  var width = 0;
  var height = 0;
  var dpr = 1;
  var raf = 0;
  var last = 0;
  var minFrameMs = 1000 / cfg.maxFps - 1;
  var reduceQuery = win.matchMedia ? win.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function reduced() {
    return !!(reduceQuery && reduceQuery.matches);
  }

  function drawGlyph(target: CanvasRenderingContext2D, index: number, c: number, r: number) {
    target.fillText(cfg.chars.charAt(state!.grid[index]), c * cfg.colWidth, r * cfg.fontSize);
  }

  // Every resting glyph at the dim alpha, pre-rendered once; only changed cells are redrawn.
  function paintLayer(full: boolean) {
    if (!layerCtx || !state || !width || !height) return;
    var lc = layerCtx;
    lc.font = cfg.fontSize + "px monospace";
    if (full) {
      lc.globalAlpha = 1;
      lc.fillStyle = cfg.background;
      lc.fillRect(0, 0, width, height);
      lc.fillStyle = cfg.ink;
      lc.globalAlpha = cfg.dim;
      for (var c = 0; c < state.cols; c++) {
        for (var r = 0; r < state.rows; r++) drawGlyph(lc, c * state.rows + r, c, r);
      }
      state.dirty.length = 0;
      lc.globalAlpha = 1;
      return;
    }
    for (var i = 0; i < state.dirty.length; i++) {
      var idx = state.dirty[i];
      var col = Math.floor(idx / state.rows);
      var row = idx - col * state.rows;
      var top = row * cfg.fontSize - cfg.fontSize + 2;
      lc.globalAlpha = 1;
      lc.fillStyle = cfg.background;
      lc.fillRect(col * cfg.colWidth, top, cfg.colWidth, cfg.fontSize);
      lc.fillStyle = cfg.ink;
      lc.globalAlpha = cfg.dim;
      drawGlyph(lc, idx, col, row);
    }
    state.dirty.length = 0;
    lc.globalAlpha = 1;
  }

  function draw() {
    // A zero-sized viewport (hidden iframe, minimised pane) has nothing to draw, and drawImage
    // of an empty canvas throws.
    if (!ctx || !state || !layer || !layer.width || !layer.height) return;
    paintLayer(false);
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0, width, height);
    ctx.font = cfg.fontSize + "px monospace";
    ctx.fillStyle = cfg.ink;
    // Trail glyphs go on top of the dim layer; this alpha composites to exactly cellAlpha().
    for (var c = 0; c < state.cols; c++) {
      var head = state.heads[c];
      var from = Math.max(0, Math.ceil(head - cfg.trail));
      var to = Math.min(state.rows - 1, Math.floor(head));
      for (var r = from; r <= to; r++) {
        var a = (fns.alpha(head - r, cfg) - cfg.dim) / (1 - cfg.dim);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        drawGlyph(ctx, c * state.rows + r, c, r);
      }
    }
    ctx.globalAlpha = 1;
  }

  function size() {
    if (!canvas) return;
    width = win.innerWidth;
    height = win.innerHeight;
    dpr = Math.min(win.devicePixelRatio || 1, cfg.maxDpr);
    var cols = Math.floor(width / cfg.colWidth);
    var rows = Math.ceil(height / cfg.fontSize) + 2;
    state = state ? fns.resize(state, cols, rows, cfg, rand) : fns.create(cols, rows, cfg, rand);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!layer) layer = doc.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    layerCtx = layer.getContext("2d");
    if (layerCtx) layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLayer(true);
  }

  function frame(now: number) {
    raf = win.requestAnimationFrame(frame);
    if (last && now - last < minFrameMs) return;
    // A long main-thread task must not freeze the rain and then make it "catch up" slowly:
    // motion follows the clock, capped so a stall never teleports the columns.
    var dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
    last = now;
    if (state) fns.step(state, dt, cfg, rand);
    draw();
  }

  function stop() {
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  function start() {
    if (raf || !canvas || reduced() || doc.hidden) return;
    raf = win.requestAnimationFrame(frame);
  }

  function attach(next: HTMLCanvasElement) {
    if (doc.documentElement.hasAttribute(cfg.passedAttribute)) return;
    if (next === canvas) return start();
    canvas = next;
    // Decoration only: a canvas failure must never break the page (attach runs in React's
    // layout phase).
    try {
      size();
      draw();
    } catch {
      return;
    }
    start();
  }

  function detach(old: HTMLCanvasElement) {
    if (old !== canvas) return;
    stop();
    canvas = null;
    ctx = null;
  }

  win.addEventListener("resize", function () {
    if (!canvas) return;
    size();
    draw();
  });
  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) stop();
    else start();
  });

  var runtime = { attach: attach, detach: detach };
  win[cfg.runtimeGlobal] = runtime;
  return runtime;
}

/**
 * Runs in `<head>` before any of the page is parsed:
 * - a viewer who already went through the gate in this tab session gets `data-gate-passed` on
 *   `<html>`, which hides every preloader by CSS from the first paint (no flash on reload);
 * - otherwise the rain runtime is installed and every rain canvas the HTML stream inserts
 *   (route `loading.tsx` first, then the page's own gate) is drawn the moment it is parsed;
 * - a click on the entry button before React is ready is remembered and honoured once it is.
 */
export function bootGate(
  win: Window & Record<string, unknown>,
  cfg: RainConfig,
  install: typeof installRainRuntime,
  fns: Parameters<typeof installRainRuntime>[2],
): void {
  var doc = win.document;
  var root = doc.documentElement;
  var passed = false;
  try {
    passed = win.sessionStorage.getItem(cfg.sessionKey) === "1";
  } catch {
    passed = false;
  }
  if (passed) {
    root.setAttribute(cfg.passedAttribute, "");
    return;
  }

  doc.addEventListener(
    "click",
    function (event) {
      var target = event.target as Element | null;
      var button = target && target.closest ? target.closest(cfg.enterSelector) : null;
      if (!button) return;
      win[cfg.queueGlobal] = true;
      button.setAttribute("data-queued", "");
    },
    true,
  );

  var runtime = install(win, cfg, fns);
  var Observer = (win as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  if (typeof Observer !== "function") return;
  var observer = new Observer(function (records: MutationRecord[]) {
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j] as Element;
        if (node.nodeType !== 1) continue;
        var found = node.matches(cfg.canvasSelector) ? node : node.querySelector(cfg.canvasSelector);
        if (found) runtime.attach(found as HTMLCanvasElement);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  // After the HTML stream ends React owns the canvases (MatrixRain attaches its own).
  doc.addEventListener("DOMContentLoaded", function () {
    observer.disconnect();
  });
}

const RAIN_FNS_SOURCE = `{create:${createRainState.toString()},step:${stepRain.toString()},resize:${resizeRainState.toString()},alpha:${cellAlpha.toString()}}`;

/** Inline `<head>` script (see {@link bootGate}). Built from the functions above. */
export const GATE_BOOT_SCRIPT = `(${bootGate.toString()})(window,${JSON.stringify(RAIN_CONFIG)},${installRainRuntime.toString()},${RAIN_FNS_SOURCE});`;

/** The runtime the boot script installed, or a fresh one (tests, script blocked). */
export function ensureRainRuntime() {
  return installRainRuntime(window as unknown as Window & Record<string, unknown>, RAIN_CONFIG, {
    create: createRainState,
    step: stepRain,
    resize: resizeRainState,
    alpha: cellAlpha,
  });
}

/** Marks the gate as passed for this tab session (the boot script reads it on reload). */
export function markGatePassed(): void {
  try {
    window.sessionStorage.setItem(RAIN_CONFIG.sessionKey, "1");
  } catch {
    /* storage unavailable: the gate shows again on reload */
  }
}

export function hideGateFromNowOn(): void {
  document.documentElement.setAttribute(RAIN_CONFIG.passedAttribute, "");
}

export function hasPassedGateThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(RAIN_CONFIG.sessionKey) === "1";
  } catch {
    return false;
  }
}

/** Takes (and clears) a click on the entry button that happened before React was ready. */
export function consumeQueuedGateEnter(): boolean {
  const w = window as unknown as Record<string, unknown>;
  const queued = w[RAIN_CONFIG.queueGlobal] === true;
  w[RAIN_CONFIG.queueGlobal] = false;
  return queued;
}

/** Remembers a click on the entry button made before the gate component could handle it. */
export function queueGateEnter(): void {
  (window as unknown as Record<string, unknown>)[RAIN_CONFIG.queueGlobal] = true;
}
