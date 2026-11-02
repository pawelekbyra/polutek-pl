#!/usr/bin/env node
// Redrawn POLUTEK wordmark (blue), from the owner image logo-polutek-source.webp (2000x667, 2026-11-02).
// Pure geometry (lines and circular/elliptical arcs), no tracing noise and no font: most letters are polygons with rounded
// corners (convex corner radius ~33 source px, inner corners sharp) plus a few arcs (P bowl, O ring, U bowl, K arm ends).
// The numbers are measured from the image (sub-pixel edges at 50% grey), see the logo section in CLAUDE.md.
// Run:  node scripts/brand/generate-wordmark-blue.mjs          -> writes app/components/brand/polutek-wordmark-blue-paths.ts
//                                                                  and public/brand/polutek-wordmark-blue(.|-mono.)svg
//       node scripts/brand/generate-wordmark-blue.mjs --print  -> prints viewBox and path
// Dependency free. Units: source pixels, scaled so that the cap height (L/E/T bars: 208.5 -> 506.3) is 100 units.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const INK = "#01286a"; // mean of the letter interiors in the source image (rgb 1,40,106)
const R = 33; // convex corner radius of the rounded terminals

const f = (v) => String(Math.round(v * 100) / 100);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => [v[0] / len(v), v[1] / len(v)];
const A = (rx, ry, sweep, x, y, large = 0) => `A${f(rx)} ${f(ry)} 0 ${large} ${sweep} ${f(x)} ${f(y)}`;
const M = (x, y) => `M${f(x)} ${f(y)}`;
const L = (x, y) => `L${f(x)} ${f(y)}`;

/** Polygon with a corner radius per vertex ([x, y, r]); clockwise on screen = outline. Radii shrink to fit the edges. */
function roundedPolygon(pts) {
  const n = pts.length;
  const prep = pts.map(([x, y, r = 0], i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
    const d1 = unit(sub([x, y], prev)), d2 = unit(sub(next, [x, y]));
    const l1 = len(sub([x, y], prev)), l2 = len(sub(next, [x, y]));
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const dot = d1[0] * d2[0] + d1[1] * d2[1];
    const half = Math.acos(Math.max(-1, Math.min(1, -dot))) / 2; // half of the interior angle
    let rr = r, t = r > 0 ? r / Math.tan(half) : 0;
    const room = Math.min(l1, l2) / 2; // two neighbouring corners share an edge at most half each
    if (t > room) { t = room; rr = t * Math.tan(half); }
    return { x, y, d1, d2, t, rr, sweep: cross > 0 ? 1 : 0 };
  });
  let d = "";
  prep.forEach((c, i) => {
    const a = [c.x - c.d1[0] * c.t, c.y - c.d1[1] * c.t];
    const b = [c.x + c.d2[0] * c.t, c.y + c.d2[1] * c.t];
    d += (i === 0 ? "M" : "L") + f(a[0]) + " " + f(a[1]);
    if (c.t > 0) d += `A${f(c.rr)} ${f(c.rr)} 0 0 ${c.sweep} ${f(b[0])} ${f(b[1])}`;
  });
  return d + "Z";
}

// ---- letters, in source pixels (y grows downwards) ----

// P: stem + semicircular bowl; the counter is a hole (counter-clockwise) with a flat left side and a round right side.
const P_left = 59.9, P_stemR = 133.7, P_top = 209.6, P_bot = 509.3;
const P_cx = 196.3, P_cy = 308.0, P_R = 98.4;
const P = [
  M(P_left + R, P_top) + L(P_cx, P_top) + A(P_R, P_R, 1, P_cx, P_cy + P_R) + L(P_stemR, P_cy + P_R) +
    L(P_stemR, P_bot - R) + A(R, R, 1, P_stemR - R, P_bot) + L(P_left + R, P_bot) + A(R, R, 1, P_left, P_bot - R) +
    L(P_left, P_top + R) + A(R, R, 1, P_left + R, P_top) + "Z",
  M(P_stemR, 274.8) + L(P_stemR, 341.2) + L(189.1, 341.2) + A(33.2, 33.2, 0, 189.1, 274.8) + "Z",
];

// O: circle, counter an ellipse a little taller than wide (83 x 86), as drawn
const O_cx = 464.7, O_cy = 357.2, O_R = 154.6;
const O = [
  M(O_cx - O_R, O_cy) + A(O_R, O_R, 1, O_cx + O_R, O_cy) + A(O_R, O_R, 1, O_cx - O_R, O_cy) + "Z",
  M(464.3 - 83, 355.7) + A(83, 86, 0, 464.3 + 83, 355.7) + A(83, 86, 0, 464.3 - 83, 355.7) + "Z",
];

const Lt = [roundedPolygon([
  [649.6, 206.6, R], [723.9, 206.6, R], [723.9, 435.7, 0], [855.8, 435.7, R], [855.8, 506.3, R], [649.6, 506.3, R],
])];

// U: round-topped stems, outer bowl = rounded rectangle (corner radius 120), inner bowl = semicircle
const U_l = 867.0, U_r = 1125.7, U_top = 206.8, U_bot = 512.5, U_cr = 120;
const U_il = 942.4, U_ir = 1051.4, U_inCy = 386.6, U_in = (U_ir - U_il) / 2;
const U = [
  M(U_l, U_top + R) + A(R, R, 1, U_l + R, U_top) + L(U_il - R, U_top) + A(R, R, 1, U_il, U_top + R) + L(U_il, U_inCy) +
    A(U_in, U_in, 0, U_ir, U_inCy) + L(U_ir, U_top + R) + A(R, R, 1, U_ir + R, U_top) + L(U_r - R, U_top) +
    A(R, R, 1, U_r, U_top + R) + L(U_r, U_bot - U_cr) + A(U_cr, U_cr, 1, U_r - U_cr, U_bot) + L(U_l + U_cr, U_bot) +
    A(U_cr, U_cr, 1, U_l, U_bot - U_cr) + "Z",
];

const T = [roundedPolygon([
  [1148.9, 208.5, R], [1402.8, 208.5, R], [1402.8, 274.8, R], [1313.3, 274.8, 0], [1313.3, 509.3, R], [1240.8, 509.3, R],
  [1240.8, 274.8, 0], [1148.9, 274.8, R],
])];

const E = [roundedPolygon([
  [1427.0, 208.6, R], [1653.0, 208.6, R], [1653.0, 274.5, R], [1500.4, 274.5, 0], [1500.4, 321.7, 0],
  [1629.8, 321.7, R], [1629.8, 385.3, R], [1500.4, 385.3, 0], [1500.4, 438.6, 0], [1653.0, 438.6, R],
  [1653.0, 506.3, R], [1427.0, 506.3, R],
])];

// K: stem + two diagonal arms with semicircular ends. Arm edges are lines y = y0 + slope * (x - x0), measured in the image.
const K_l = 1681.0, K_r = 1755.9, K_top = 206.1, K_bot = 509.3;
const line = (x0, y0, slope) => Object.assign((x) => y0 + slope * (x - x0), { slope });
const armTop = line(1830, 247.1, -1.03), armBot = line(1830, 343.8, -0.935);
const legTop = line(1830, 354.2, 1.05), legBot = line(1790, 419.2, 1.1);
const meet = (l1, l2) => { const x = (l2(0) - l1(0)) / (l1.slope - l2.slope); return [x, l1(x)]; };
/** Circle inscribed between two lines that meet at a vertex to its left, with its right-most point at xMax. */
function capCircle(lineA, lineB, xMax) {
  const v = meet(lineA, lineB);
  const dA = unit([1, lineA.slope]), dB = unit([1, lineB.slope]);
  const u = unit([dA[0] + dB[0], dA[1] + dB[1]]); // bisector pointing to the right
  const sinH = Math.sin(Math.acos(dA[0] * dB[0] + dA[1] * dB[1]) / 2);
  const s = (xMax - v[0]) / (u[0] + sinH);
  const c = [v[0] + s * u[0], v[1] + s * u[1]], r = s * sinH;
  const foot = (ln) => { const d = unit([1, ln.slope]); const t = (c[0]) * d[0] + (c[1] - ln(0)) * d[1]; return [t * d[0], ln(0) + t * d[1]]; };
  return { c, r, a: foot(lineA), b: foot(lineB) };
}
const arm = capCircle(armTop, armBot, 1926.3);
const leg = capCircle(legTop, legBot, 1928.8);
// lower notch: a sharp apex where the underside of the leg meets a 45 degree line running down-left to the stem
const stemPoint = [K_r, 412.2];
const notchLine = Object.assign((x) => stemPoint[1] - (x - stemPoint[0]), { slope: -1 });
const apex = meet(legBot, notchLine);
const K = [
  M(K_l, K_top + R) + A(R, R, 1, K_l + R, K_top) + L(K_r - R, K_top) + A(R, R, 1, K_r, K_top + R) +
    L(K_r, armTop(K_r)) + L(...arm.a) + A(arm.r, arm.r, 1, ...arm.b, 1) + L(...meet(armBot, legTop)) + L(...leg.a) +
    A(leg.r, leg.r, 1, ...leg.b, 1) + L(...apex) + L(...stemPoint) +
    L(K_r, K_bot - R) + A(R, R, 1, K_r - R, K_bot) + L(K_l + R, K_bot) + A(R, R, 1, K_l, K_bot - R) + "Z",
];

const order = ["P", "O", "L", "U", "T", "E", "K"];
export const LETTERS = { P, O, L: Lt, U, T, E, K };

// ---- scale: cap height 100 units, origin at the top-left of the ink box ----
const X0 = 59.9, Y0 = 202.6, X1 = 1928.8, Y1 = 512.5;
const SCALE = 100 / (506.3 - 208.5);
function transform(d) {
  return d.replace(/([MLA])([^MLAZ]*)/g, (_, cmd, args) => {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === "A") {
      const [rx, ry, rot, large, sweep, x, y] = n;
      return `A${f(rx * SCALE)} ${f(ry * SCALE)} ${rot} ${large} ${sweep} ${f((x - X0) * SCALE)} ${f((y - Y0) * SCALE)}`;
    }
    return cmd + f((n[0] - X0) * SCALE) + " " + f((n[1] - Y0) * SCALE);
  });
}
export const VIEWBOX = `0 0 ${f((X1 - X0) * SCALE)} ${f((Y1 - Y0) * SCALE)}`;
export const PATH_D = order.flatMap((k) => LETTERS[k]).map(transform).join("");
export const SOURCE_BOX = { X0, Y0, X1, Y1, SCALE };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  if (process.argv[2] === "--print") {
    console.log(VIEWBOX);
    console.log(PATH_D);
  } else {
    const ts =
      "// Generated by scripts/brand/generate-wordmark-blue.mjs: do not edit by hand.\n" +
      `export const WORDMARK_BLUE_VIEWBOX = "${VIEWBOX}";\nexport const WORDMARK_BLUE_INK = "${INK}";\n` +
      `export const WORDMARK_BLUE_PATH =\n  "${PATH_D}";\n`;
    writeFileSync(path.join(root, "app/components/brand/polutek-wordmark-blue-paths.ts"), ts);
    const svg = (fill) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="POLUTEK"><title>POLUTEK</title><path fill="${fill}" d="${PATH_D}"/></svg>\n`;
    writeFileSync(path.join(root, "public/brand/polutek-wordmark-blue.svg"), svg(INK));
    writeFileSync(path.join(root, "public/brand/polutek-wordmark-blue-mono.svg"), svg("currentColor"));
    console.log("written", VIEWBOX, PATH_D.length);
  }
}
