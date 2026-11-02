#!/usr/bin/env node
// POLUTEK symbol (play badge with two orbit swooshes), drawn in front of the blue POLUTEK wordmark.
// Brief (owner 2026-11-02, reference image /opt/claude/logo-symbol-source.png): a rounded "play" body with a play triangle inside
// and two thin swooshes, one above the top-right, one below the bottom-left, like an orbit. Body rim and swooshes in the wordmark
// ink (#01286a, --brand-ink), the inner play orange with a light effect; the body must be LIGHT (thin rim, big opening), never
// heavier than the lettering.
//
// Pure geometry, no tracing, no font. Units = wordmark units (cap height of L/E/T = 100), so the symbol and the letters share one
// coordinate system and the radii can be compared directly (letter terminals: R = 11.08 units, letter stroke ~25 units).
//   body  = sharp isosceles triangle (left side vertical, apex right) with filleted corners (circular arcs);
//   rim   = body minus the same triangle offset inwards by `rim` (homothety about the incentre = exact parallel offset) whose
//           fillets are concentric with the outer ones (radius - rim), so the rim is EXACTLY uniform, corners included;
//   play  = the triangle offset by rim + gap with its own (smaller) fillets;
//   swooshes = crescents between two circular arcs drawn in "orbit space" and then squashed by an affine map (a tilted ellipse,
//           the orbit seen at an angle); the second swoosh is the first rotated 180 degrees about the orbit centre (point
//           symmetry). Every curve is an SVG arc (A), so the outlines have the minimum number of nodes and no Bezier noise.
//
// Run:  node scripts/brand/generate-symbol.mjs                   -> app/components/brand/polutek-symbol-paths.ts (variant CHOSEN)
//                                                                  and public/brand/polutek-wordmark-blue-symbol.svg,
//                                                                  polutek-symbol.svg, polutek-symbol-small.svg
//       node scripts/brand/generate-symbol.mjs --variants <dir>  -> <dir>/symbol-<A..E>.svg and lockup-<A..E>.svg (preview)
//       node scripts/brand/generate-symbol.mjs --print <A..E>      -> geometry report of a variant
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { INK, PATH_D as WORDMARK_D, VIEWBOX as WORDMARK_VIEWBOX } from "./generate-wordmark-blue.mjs";

export { INK };
const CAP_MID = 52.0; // vertical centre of the cap height in wordmark units (L/E/T: 1.98 .. 101.98)
/** The live variant (owner's choice 2026-11-02 from the preview sheet /opt/claude/shots-logo/symbol-variants.png). */
export const CHOSEN = "A";
/** Optical gap from the body apex to the P stem, as a share of the cap height (0.40 = 40 units), with the orbit arcs. */
export const GAP_RATIO = 0.4;
/**
 * The orbit arcs ("swooshes"). Owner 2026-11-02, after seeing it live: no arcs, the rim + orange play alone. The arc code stays:
 * ARCS = true makes the plain symbol files carry the arcs again; the arcs version is also always written as the
 * "-orbit" files (logo variant "wordmark-blue-symbol-orbit", passphrase "przywróć łuki").
 */
export const ARCS = false;
/**
 * Without the arcs the body alone faces the letters, so it is drawn a little bigger than with them (the arcs used to add
 * visual mass): every length of variant A scaled by BODY_SCALE (body 104 -> 110 units against 100-unit letters; 104 looked
 * small next to the lettering, 114 started to compete with it), and a gap of 0.38 of the cap height (0.34 felt tight at 21px).
 */
export const BODY_SCALE = 110 / 104;
export const GAP_RATIO_PLAIN = 0.38;
const SCALED = ["height", "rLeft", "rApex", "rim", "gap", "rPlayLeft", "rPlayApex", "playShift"];
/** Parameters of the live symbol: variant CHOSEN, with or without the arcs. */
export function liveParams(arcs = ARCS) {
  const p = VARIANTS[CHOSEN];
  if (arcs) return p;
  const q = { ...p, swoosh: null };
  for (const k of SCALED) q[k] = p[k] * BODY_SCALE;
  return q;
}
export const liveGapRatio = (arcs = ARCS) => (arcs ? GAP_RATIO : GAP_RATIO_PLAIN);

const f = (v) => String(Math.round(v * 100) / 100);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const dir = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
const ang = (v) => Math.atan2(v[1], v[0]);

/** Sample a circular arc from angle a0 going in direction s (+1 clockwise on screen) until a1. */
function sampleArc(c, r, a0, a1, s, n = 24) {
  let span = s > 0 ? a1 - a0 : a0 - a1;
  while (span < 0) span += 2 * Math.PI;
  const out = [];
  for (let i = 0; i <= n; i++) out.push(add(c, mul([Math.cos(a0 + s * span * (i / n)), Math.sin(a0 + s * span * (i / n))], r)));
  return out;
}

/** Filleted polygon. pts: [[x, y, r]], clockwise on screen. Returns the path and a dense polyline of the outline. */
function filleted(pts) {
  const n = pts.length;
  let d = "";
  const poly = [];
  pts.forEach(([x, y, r], i) => {
    const V = [x, y], P = pts[(i + n - 1) % n], N = pts[(i + 1) % n];
    const d1 = unit(sub(V, P)), d2 = unit(sub([N[0], N[1]], V));
    const half = Math.acos(Math.max(-1, Math.min(1, -(d1[0] * d2[0] + d1[1] * d2[1])))) / 2;
    const t = r / Math.tan(half);
    const a = sub(V, mul(d1, t)), b = add(V, mul(d2, t));
    d += (i === 0 ? "M" : "L") + f(a[0]) + " " + f(a[1]);
    if (r > 0) {
      d += `A${f(r)} ${f(r)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
      const c = add(V, mul(unit(add(mul(d1, -1), d2)), r / Math.sin(half)));
      poly.push(...sampleArc(c, r, ang(sub(a, c)), ang(sub(b, c)), 1));
    } else poly.push(a);
  });
  return { d: d + "Z", poly };
}

/** Isosceles play triangle, left side vertical: top-left, apex, bottom-left (clockwise on screen). */
const triangle = (x, y, w, h) => [[x, y], [x + w, y + h / 2], [x, y + h]];
function incentre(T) {
  const [A, B, C] = T;
  const a = len(sub(B, C)), b = len(sub(A, C)), c = len(sub(A, B)), p = a + b + c;
  const I = [(a * A[0] + b * B[0] + c * C[0]) / p, (a * A[1] + b * B[1] + c * C[1]) / p];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  return { I, r: (2 * area) / p };
}
/** Exact inward parallel offset of a triangle by d (homothety about the incentre). */
function offset(T, d) {
  const { I, r } = incentre(T);
  const k = (r - d) / r;
  return T.map((v) => add(I, mul(sub(v, I), k)));
}
const bbox = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/** Circle through three points. */
function circle3(p1, p2, p3) {
  const ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1];
  const dd = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / dd;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / dd;
  return { c: [ux, uy], r: Math.hypot(ax - ux, ay - uy) };
}

/**
 * One swoosh: crescent between an outer arc (circle O, radius R, from angle a1 to a2 clockwise) and an inner arc through both
 * tips and through the point at angle aq, `w` inside the outer circle (the thickest place). Then the affine map M (about O).
 */
function swoosh(O, R, a1, a2, aq, w, M) {
  const P1 = add(O, mul(dir(a1), R)), P2 = add(O, mul(dir(a2), R)), Q = add(O, mul(dir(aq), R - w));
  const inner = circle3(P1, P2, Q);
  // inner arc from P2 back to P1 through Q: counter-clockwise on screen
  const b2 = ang(sub(P2, inner.c)), bq = ang(sub(Q, inner.c)), b1 = ang(sub(P1, inner.c));
  const ccwSpan = (from, to) => { let s = from - to; while (s < 0) s += 2 * Math.PI; return s; };
  const throughQ = ccwSpan(b2, bq) < ccwSpan(b2, b1);
  const s = throughQ ? -1 : 1;
  const innerSpan = throughQ ? ccwSpan(b2, b1) : 2 * Math.PI - ccwSpan(b2, b1);
  const outerSpan = (((a2 - a1) % 360) + 360) % 360;
  const map = (p) => add(O, M.apply(sub(p, O)));
  const polyOuter = sampleArc(O, R, (a1 * Math.PI) / 180, (a2 * Math.PI) / 180, 1, 48);
  const polyInner = sampleArc(inner.c, inner.r, b2, b1, s, 48);
  const poly = [...polyOuter, ...polyInner].map(map);
  const arc = (r, large, sweep, p) => {
    const [rx, ry, rot] = M.ellipse(r);
    return `A${f(rx)} ${f(ry)} ${f(rot)} ${large} ${sweep} ${f(map(p)[0])} ${f(map(p)[1])}`;
  };
  const m1 = map(P1);
  const d = `M${f(m1[0])} ${f(m1[1])}` + arc(R, outerSpan > 180 ? 1 : 0, 1, P2) + arc(inner.r, innerSpan > Math.PI ? 1 : 0, s > 0 ? 1 : 0, P1) + "Z";
  return { d, poly, P1, P2, inner };
}

/** Affine squash: scale by `e` across the axis at angle `theta` (degrees). Maps circles to ellipses (rx along theta). */
function squash(theta, e) {
  const [c, s] = dir(theta);
  const apply = ([x, y]) => {
    const u = x * c + y * s, v = -x * s + y * c; // into the axis frame
    const v2 = v * e;
    return [u * c - v2 * s, u * s + v2 * c];
  };
  return { apply, ellipse: (r) => [r, r * e, theta] };
}
const rot180 = (O, p) => sub(mul(O, 2), p);

function minDist(a, b) {
  let m = Infinity;
  for (const p of a) for (const q of b) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1]));
  return m;
}
function inside(poly, p) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Parameters (all in wordmark units, cap height = 100):
 *   height      ink height of the body (the letters are 100)
 *   aspect      width / height of the sharp triangle (1 = as wide as tall before the fillets)
 *   rLeft/rApex outer fillet radii (left corners / apex)
 *   rim         thickness of the navy rim (letter stroke ~25)
 *   gap         white (transparent) ring between rim and play; 0 = the play fills the whole opening
 *   rPlayLeft/rPlayApex  fillets of the orange play
 *   playShift   optical shift of the play to the right (units)
 *   swoosh: { w (max thickness), span (degrees), lead (where the thickest point is, -1..1 along the span; 0 = middle),
 *             tilt (degrees of the orbit's major axis, negative = up-right), squash (minor/major), clear (gap to the body),
 *             mid (angle of the swoosh middle in orbit space, degrees) }
 *   effect: { gloss (0..1 white highlight at the top), glow (0..1 orange halo in the gap), shade (0..1 deeper orange at the
 *             bottom), stops [top, mid, bottom] }
 */
export const VARIANTS = {
  A: {
    name: "Zrownowazony",
    height: 104, aspect: 0.92, rLeft: 25, rApex: 19, rim: 12.5, gap: 5.5, rPlayLeft: 7.5, rPlayApex: 6, playShift: 1.2,
    swoosh: { w: 8, span: 66, lead: 0.15, tilt: -34, squash: 0.8, clear: 5, mid: -34 },
    effect: { gloss: 0.5, glow: 0.35, shade: 0.5, stops: ["#ffb340", "#ff9419", "#ff7a00"] },
  },
  B: {
    name: "Lekki",
    height: 102, aspect: 0.92, rLeft: 23, rApex: 17.5, rim: 10, gap: 5, rPlayLeft: 8, rPlayApex: 6.5, playShift: 1.2,
    swoosh: { w: 6.5, span: 60, lead: 0.12, tilt: -34, squash: 0.82, clear: 4.5, mid: -34 },
    effect: { gloss: 0.4, glow: 0.25, shade: 0.4, stops: ["#ffb340", "#ff9419", "#ff7a00"] },
  },
  C: {
    name: "Wyrazisty",
    height: 106, aspect: 0.94, rLeft: 27, rApex: 21, rim: 15, gap: 6, rPlayLeft: 7, rPlayApex: 5.5, playShift: 1.4,
    swoosh: { w: 10, span: 76, lead: 0.18, tilt: -34, squash: 0.78, clear: 5.5, mid: -34 },
    effect: { gloss: 0.6, glow: 0.55, shade: 0.6, stops: ["#ffbb4d", "#ff9419", "#f57200"] },
  },
  D: {
    name: "Minimalny",
    height: 100, aspect: 0.92, rLeft: 24, rApex: 18, rim: 11, gap: 0, rPlayLeft: 13, rPlayApex: 7, playShift: 0,
    swoosh: { w: 6.5, span: 54, lead: 0, tilt: -34, squash: 0.84, clear: 4.5, mid: -34 },
    effect: { gloss: 0.0, glow: 0, shade: 0.25, stops: ["#ffa733", "#ff9419", "#ff7a00"] },
  },
  E: {
    name: "Dynamiczny",
    height: 104, aspect: 0.94, rLeft: 25, rApex: 18, rim: 12, gap: 5.5, rPlayLeft: 7.5, rPlayApex: 6, playShift: 1.4,
    swoosh: { w: 9.5, span: 96, lead: 0.6, tilt: -28, squash: 0.68, clear: 4.5, mid: -20 },
    effect: { gloss: 0.6, glow: 0.5, shade: 0.55, stops: ["#ffc04d", "#ff8f12", "#f26c00"] },
  },
};

/** Build the symbol geometry for parameters p. Body ink box top-left at (0, 0) before the final translate. */
export function buildSymbol(p) {
  // solve the sharp triangle height so that the filleted body is p.height tall
  const bodyFor = (H) => filleted(triangle(0, 0, H * p.aspect, H).map((v, i) => [...v, i === 1 ? p.rApex : p.rLeft]));
  let lo = p.height, hi = p.height * 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, b = bbox(bodyFor(mid).poly);
    if (b.y1 - b.y0 > p.height) hi = mid; else lo = mid;
  }
  const H = (lo + hi) / 2;
  const T = triangle(0, 0, H * p.aspect, H);
  const outer = filleted(T.map((v, i) => [...v, i === 1 ? p.rApex : p.rLeft]));
  const Th = offset(T, p.rim);
  const hole = filleted(Th.map((v, i) => [...v, Math.max(0, (i === 1 ? p.rApex : p.rLeft) - p.rim)]));
  const Tp = offset(T, p.rim + p.gap).map((v) => [v[0] + p.playShift, v[1]]);
  const play = p.gap > 0
    ? filleted(Tp.map((v, i) => [...v, i === 1 ? p.rPlayApex : p.rPlayLeft]))
    : hole; // the play fills the opening
  const bodyBox = bbox(outer.poly);
  // orbit centre: centre of the body ink box
  const O = [(bodyBox.x0 + bodyBox.x1) / 2, (bodyBox.y0 + bodyBox.y1) / 2];
  if (!p.swoosh) return { H, T, outer, hole, play, sw1: null, sw2: null, O, R: null, box: bodyBox, bodyBox, params: p };

  const s = p.swoosh, M = squash(s.tilt, s.squash);
  const a1 = s.mid - s.span / 2, a2 = s.mid + s.span / 2, aq = s.mid + (s.lead * s.span) / 2;
  const build = (R) => {
    const one = swoosh(O, R, a1, a2, aq, s.w, M);
    const two = { d: rotPath(one.d, O), poly: one.poly.map((q) => rot180(O, q)) };
    return [one, two];
  };
  // solve the orbit radius for the requested clearance to the body
  let rlo = 20, rhi = 200;
  for (let i = 0; i < 50; i++) {
    const R = (rlo + rhi) / 2;
    const [one, two] = build(R);
    const clash = one.poly.some((q) => inside(outer.poly, q)) || two.poly.some((q) => inside(outer.poly, q));
    const dmin = Math.min(minDist(one.poly, outer.poly), minDist(two.poly, outer.poly));
    if (clash || dmin < s.clear) rlo = R; else rhi = R;
  }
  const R = rhi;
  const [sw1, sw2] = build(R);
  const all = [...outer.poly, ...sw1.poly, ...sw2.poly];
  const box = bbox(all);
  return { H, T, outer, hole, play, sw1, sw2, O, R, box, bodyBox, params: p };
}

/** Rotate an absolute M/L/A path by 180 degrees about O (radii and flags are unchanged by a half turn). */
function rotPath(d, O) {
  return d.replace(/([MLA])([^MLAZ]*)/g, (_, cmd, args) => {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === "A") {
      const [rx, ry, rot, large, sweep, x, y] = n;
      return `A${f(rx)} ${f(ry)} ${f(rot)} ${large} ${sweep} ${f(2 * O[0] - x)} ${f(2 * O[1] - y)}`;
    }
    return cmd + f(2 * O[0] - n[0]) + " " + f(2 * O[1] - n[1]);
  });
}
/** Translate an absolute M/L/A path. */
export function movePath(d, dx, dy) {
  return d.replace(/([MLA])([^MLAZ]*)/g, (_, cmd, args) => {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === "A") {
      const [rx, ry, rot, large, sweep, x, y] = n;
      return `A${f(rx)} ${f(ry)} ${f(rot)} ${large} ${sweep} ${f(x + dx)} ${f(y + dy)}`;
    }
    return cmd + f(n[0] + dx) + " " + f(n[1] + dy);
  });
}

/** Raw parts of the symbol (for the React component): same placement rules as symbolMarkup. */
export function symbolParts(g, { x0 = 0, cy = CAP_MID } = {}) {
  const dx = x0 - g.box.x0, dy = cy - (g.bodyBox.y0 + g.bodyBox.y1) / 2;
  const mv = (d) => movePath(d, dx, dy);
  const pb = bbox(g.play.poly);
  return {
    navy: mv(g.outer.d) + mv(reverse(g.hole.d)) + (g.sw1 ? mv(g.sw1.d) + mv(g.sw2.d) : ""),
    hole: mv(g.hole.d),
    play: mv(g.play.d),
    playY: [Math.round((pb.y0 + dy) * 100) / 100, Math.round((pb.y1 + dy) * 100) / 100],
    blur: Math.round(g.params.gap * 0.55 * 100) / 100,
    effect: g.params.effect,
    top: g.box.y0 + dy,
    bottom: g.box.y1 + dy,
    width: g.box.x1 - g.box.x0,
    bodyRight: g.bodyBox.x1 + dx,
  };
}

/**
 * SVG fragments of the symbol, positioned so that the body's vertical centre is at `cy` and the ink box starts at x = `x0`.
 * `id` prefixes the gradient/filter ids (several symbols on one page). `simple` = small-size version (flat gradient only).
 */
export function symbolMarkup(g, { id = "ps", x0 = 0, cy = CAP_MID, ink = `var(--brand-ink, ${INK})`, simple = false } = {}) {
  const dx = x0 - g.box.x0, dy = cy - (g.bodyBox.y0 + g.bodyBox.y1) / 2;
  const mv = (d) => movePath(d, dx, dy);
  const e = g.params.effect;
  const pb = bbox(g.play.poly);
  const py0 = pb.y0 + dy, py1 = pb.y1 + dy;
  const [cTop, cMid, cBot] = e.stops;
  const defs = [];
  // base: amber at the top, deep orange at the bottom (light from above)
  defs.push(`<linearGradient id="${id}-o" gradientUnits="userSpaceOnUse" x1="0" y1="${f(py0)}" x2="0" y2="${f(py1)}"><stop offset="0" stop-color="${cTop}"/><stop offset=".5" stop-color="${cMid}"/><stop offset="1" stop-color="${cBot}"/></linearGradient>`);
  let layers = "";
  const rimD = mv(g.outer.d) + mv(reverse(g.hole.d));
  const playD = mv(g.play.d);
  if (!simple && e.glow > 0 && g.params.gap > 0) {
    // soft orange halo inside the opening only (clipped to the hole, so it never touches the rim or the outside)
    defs.push(`<clipPath id="${id}-h"><path d="${mv(g.hole.d)}"/></clipPath>`);
    defs.push(`<filter id="${id}-b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(g.params.gap * 0.55)}"/></filter>`);
    layers += `<g clip-path="url(#${id}-h)"><path d="${playD}" fill="${cMid}" opacity="${e.glow}" filter="url(#${id}-b)"/></g>`;
  }
  layers += `<path fill="url(#${id}-o)" d="${playD}"/>`;
  if (!simple && e.shade > 0) {
    // inner shade: a slightly deeper tone along the lower slanted edge (soft inner shadow without a filter)
    defs.push(`<linearGradient id="${id}-s" gradientUnits="userSpaceOnUse" x1="0" y1="${f(py0)}" x2="0" y2="${f(py1)}"><stop offset=".55" stop-color="#b84300" stop-opacity="0"/><stop offset="1" stop-color="#b84300" stop-opacity="${f(0.45 * e.shade)}"/></linearGradient>`);
    layers += `<path fill="url(#${id}-s)" d="${playD}"/>`;
  }
  if (!simple && e.gloss > 0) {
    // gloss: white light from the top fading out before the middle (no hard edge)
    defs.push(`<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="${f(py0)}" x2="0" y2="${f(py1)}"><stop offset="0" stop-color="#fff" stop-opacity="${f(0.75 * e.gloss)}"/><stop offset=".22" stop-color="#fff" stop-opacity="${f(0.32 * e.gloss)}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    layers += `<path fill="url(#${id}-g)" d="${playD}"/>`;
  }
  const navy = `<path style="fill:${ink}" fill-rule="evenodd" d="${rimD}${g.sw1 ? mv(g.sw1.d) + mv(g.sw2.d) : ""}"/>`;
  return {
    defs: `<defs>${defs.join("")}</defs>`,
    body: navy + layers,
    width: g.box.x1 - g.box.x0,
    top: g.box.y0 + dy,
    bottom: g.box.y1 + dy,
  };
}

/** Reverse the direction of a closed path made of M/L/A (for the hole of the rim). */
function reverse(d) {
  const segs = [];
  let cur = null, start = null;
  d.replace(/([MLAZ])([^MLAZ]*)/g, (_, cmd, args) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === "M") { cur = [n[0], n[1]]; start = cur; }
    else if (cmd === "L") { segs.push({ t: "L", from: cur, to: [n[0], n[1]] }); cur = [n[0], n[1]]; }
    else if (cmd === "A") { segs.push({ t: "A", from: cur, to: [n[5], n[6]], a: n }); cur = [n[5], n[6]]; }
    else if (cmd === "Z") { if (cur[0] !== start[0] || cur[1] !== start[1]) segs.push({ t: "L", from: cur, to: start }); }
    return "";
  });
  let out = `M${f(start[0])} ${f(start[1])}`;
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (s.t === "L") out += `L${f(s.from[0])} ${f(s.from[1])}`;
    else out += `A${f(s.a[0])} ${f(s.a[1])} ${f(s.a[2])} ${s.a[3]} ${1 - s.a[4]} ${f(s.from[0])} ${f(s.from[1])}`;
  }
  return out + "Z";
}

/** Lockup: symbol + wordmark. `gapRatio` = optical gap symbol -> P as a share of the cap height. */
export function lockupMarkup(g, { id = "pl", gapRatio = GAP_RATIO, simple = false } = {}) {
  const s = symbolMarkup(g, { id, simple });
  // optical gap: measured from the body apex (the eye reads the body), the swoosh tip may come a little closer
  const bodyRight = g.bodyBox.x1 - g.box.x0;
  const shift = bodyRight + gapRatio * 100;
  const [, , ww, wh] = WORDMARK_VIEWBOX.split(" ").map(Number);
  const top = Math.min(0, s.top), bottom = Math.max(wh, s.bottom);
  const width = Math.max(s.width, shift + ww);
  const vb = `0 ${f(top)} ${f(width)} ${f(bottom - top)}`;
  const word = `<path style="fill:var(--brand-ink, ${INK})" d="${movePath(WORDMARK_D, shift, 0)}"/>`;
  return { vb, inner: s.defs + s.body + word, width, height: bottom - top, top, swooshToP: shift - s.width };
}

export function symbolSvg(g, opts = {}) {
  const s = symbolMarkup(g, { ...opts, ink: INK, cy: 0 });
  const vb = `0 ${f(s.top)} ${f(s.width)} ${f(s.bottom - s.top)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="POLUTEK"><title>POLUTEK</title>${s.defs}${s.body}</svg>\n`;
}
export function lockupSvg(g, opts = {}) {
  const l = lockupMarkup(g, opts);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${l.vb}" role="img" aria-label="POLUTEK"><title>POLUTEK</title>${l.inner.replaceAll(`var(--brand-ink, ${INK})`, INK)}</svg>\n`;
}

export function report(key) {
  const g = buildSymbol(VARIANTS[key]);
  const l = lockupMarkup(g);
  return {
    variant: key,
    bodyInk: [f(g.bodyBox.x1 - g.bodyBox.x0), f(g.bodyBox.y1 - g.bodyBox.y0)],
    symbolInk: [f(g.box.x1 - g.box.x0), f(g.box.y1 - g.box.y0)],
    orbitR: f(g.R),
    holeRadii: [f(g.params.rLeft - g.params.rim), f(g.params.rApex - g.params.rim)],
    lockupViewBox: l.vb,
    swooshTipToP: f(l.swooshToP),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "--print") {
    console.log(JSON.stringify(report(arg ?? "A"), null, 1));
  } else if (cmd === "--variants") {
    const dir = path.resolve(arg ?? "symbol-variants");
    mkdirSync(dir, { recursive: true });
    for (const k of Object.keys(VARIANTS)) {
      const g = buildSymbol(VARIANTS[k]);
      writeFileSync(path.join(dir, `symbol-${k}.svg`), symbolSvg(g, { id: `s${k}` }));
      writeFileSync(path.join(dir, `symbol-${k}-small.svg`), symbolSvg(g, { id: `t${k}`, simple: true }));
      writeFileSync(path.join(dir, `lockup-${k}.svg`), lockupSvg(g, { id: `l${k}` }));
      console.log(JSON.stringify(report(k)));
    }
  } else if (!cmd) {
    // the live symbol (owner's choice 2026-11-02: variant A) -> TS paths for the header component + standalone files
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const set = (arcs) => {
      const g = buildSymbol(liveParams(arcs));
      const parts = symbolParts(g);
      const l = lockupMarkup(g, { id: "pws", gapRatio: liveGapRatio(arcs) });
      return { g, parts, l, shift: parts.bodyRight + liveGapRatio(arcs) * 100, arcs };
    };
    const plain = set(ARCS), orbit = set(true);
    const obj = ({ parts, l, shift, arcs }) =>
      `{\n  viewBox: "${l.vb}",\n  wordmarkDx: ${f(shift)},\n` +
      `  /** rim (evenodd hole)${arcs ? " + both orbit arcs" : ""}, in the ink colour */\n  navy: "${parts.navy}",\n` +
      `  /** the opening of the rim (clip for the orange halo) */\n  hole: "${parts.hole}",\n` +
      `  /** the orange play */\n  play: "${parts.play}",\n` +
      `  /** top and bottom of the play (gradient axis) */\n  playY: [${parts.playY.join(", ")}],\n  haloBlur: ${parts.blur},\n} as const`;
    const e = plain.parts.effect;
    const ts =
      `// Generated by scripts/brand/generate-symbol.mjs (variant ${CHOSEN}): do not edit by hand.\n` +
      `// Units: wordmark units (cap height 100). A lockup = the symbol at x 0 + the wordmark path shifted right by wordmarkDx.\n` +
      `export const SYMBOL_VARIANT = "${CHOSEN}";\n` +
      `/** The live symbol (ARCS = ${ARCS}): logo variant "wordmark-blue-symbol". */\nexport const SYMBOL = ${obj(plain)};\n` +
      `/** The same symbol with the two orbit arcs: logo variant "wordmark-blue-symbol-orbit". */\nexport const SYMBOL_ORBIT = ${obj(orbit)};\n` +
      `export const SYMBOL_EFFECT = ${JSON.stringify({ stops: e.stops, glow: e.glow, shade: f(0.45 * e.shade), glossTop: f(0.75 * e.gloss), glossMid: f(0.32 * e.gloss) })} as const;\n`;
    writeFileSync(path.join(root, "app/components/brand/polutek-symbol-paths.ts"), ts);
    const gap = (arcs) => ({ gapRatio: liveGapRatio(arcs) });
    writeFileSync(path.join(root, "public/brand/polutek-wordmark-blue-symbol.svg"), lockupSvg(plain.g, { id: "pws", ...gap(ARCS) }));
    writeFileSync(path.join(root, "public/brand/polutek-wordmark-blue-symbol-orbit.svg"), lockupSvg(orbit.g, { id: "pwo", ...gap(true) }));
    writeFileSync(path.join(root, "public/brand/polutek-symbol.svg"), symbolSvg(plain.g, { id: "ps" }));
    writeFileSync(path.join(root, "public/brand/polutek-symbol-orbit.svg"), symbolSvg(orbit.g, { id: "po" }));
    writeFileSync(path.join(root, "public/brand/polutek-symbol-small.svg"), symbolSvg(plain.g, { id: "pss", simple: true }));
    console.log("written variant", CHOSEN, "plain", plain.l.vb, "dx", f(plain.shift), "| orbit", orbit.l.vb, "dx", f(orbit.shift));
  } else {
    console.log("usage: (no args) | --variants <dir> | --print <A..E>");
  }
}
