#!/usr/bin/env node
/**
 * Generates the static world map of the admin panel (apps/admin/components/analytics/world/geo.generated.ts):
 * country outlines projected once with Equal Earth (an equal-area projection, so no country looks bigger than
 * it is, which matters on a choropleth), one point for every territory too small for the 1:110m outlines, and
 * the viewBoxes of the region presets. The panel then ships plain SVG path strings: no map library, no topojson,
 * no request to any CDN at runtime (the panel's strict CSP forbids external sources).
 *
 * Data: visionscarto-world-atlas 1.0.0 (BSD-3-Clause), a modification of world-atlas / Natural Earth (public
 * domain) that follows the UN position on borders (Crimea is part of Ukraine, Western Sahara per UN).
 * Codes: ISO 3166-1 alpha-2, the same codes Cloudflare sends in CF-IPCountry (Kosovo = XK).
 *
 * The generation dependencies are NOT project dependencies. Run it from a scratch install:
 *   mkdir -p /tmp/geo && cd /tmp/geo && npm init -y >/dev/null \
 *     && npm i visionscarto-world-atlas@1.0.0 d3-geo@3.1.1 topojson-client@3.1.0 i18n-iso-countries@7.14.0
 *   GEO_DEPS=/tmp/geo node scripts/geo/build-world-map.mjs
 * Output is deterministic; commit the generated file. Docs: docs/architecture/admin-world-map.md.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";

const depsDir = process.env.GEO_DEPS;
if (!depsDir) {
  console.error("Set GEO_DEPS to a directory with the generation packages installed (see the header).");
  process.exit(1);
}
const req = createRequire(path.join(path.resolve(depsDir), "package.json"));
const { geoEqualEarth, geoPath, geoArea, geoCentroid } = req("d3-geo");
const topojson = req("topojson-client");
const countries = req("i18n-iso-countries");
const atlas110 = req("visionscarto-world-atlas/world/110m.json");
const atlas50 = req("visionscarto-world-atlas/world/50m.json");

const WIDTH = 1000;
const DIGITS = 1;

/** Natural Earth entities without an ISO code, mapped to the code Cloudflare reports for their visitors. */
const EXTRA_A3 = { XKX: "XK", SOL: "SO", CYN: "CY" };
/** Never drawn: Antarctica (no visitors, a third of the frame) and 50m-only fragments without a country. */
const SKIP_A3 = new Set(["ATA", "IOA", "ATC", "KAS"]);
/**
 * ISO territories that the 50m atlas folds into another country's outline or omits (lon, lat of the main
 * island or town). They get a point marker, so a visitor from Réunion or Gibraltar is still visible.
 */
const MANUAL_POINTS = {
  GF: [-53.1, 3.9], GI: [-5.35, 36.14], GP: [-61.55, 16.25], MQ: [-61.02, 14.64], YT: [45.15, -12.82], RE: [55.53, -21.12],
  SJ: [16.0, 78.5], TK: [-171.85, -9.2], UM: [166.62, 19.29], BQ: [-68.27, 12.18], CX: [105.69, -10.45], CC: [96.87, -12.17],
  BV: [3.4, -54.42],
};
/** Region presets of the map (lon/lat boxes); the viewBox keeps the map's aspect ratio. */
const REGIONS = [
  ["europe", "Europa", [-25, 34, 45, 71]],
  ["north-america", "Ameryka Północna", [-170, 7, -50, 75]],
  ["south-america", "Ameryka Południowa", [-92, -56, -30, 14]],
  ["africa", "Afryka", [-20, -36, 55, 38]],
  ["asia", "Azja", [25, -12, 150, 72]],
  ["oceania", "Oceania", [110, -50, 180, 2]],
];

const codeOf = (a3) => EXTRA_A3[a3] ?? countries.alpha3ToAlpha2(a3) ?? null;

function largestPolygon(feature) {
  const g = feature.geometry;
  if (g.type !== "MultiPolygon") return feature;
  let best = null;
  let bestArea = -1;
  for (const coords of g.coordinates) {
    const poly = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: coords } };
    const a = geoArea(poly);
    if (a > bestArea) {
      bestArea = a;
      best = poly;
    }
  }
  return best;
}

const fc110 = topojson.feature(atlas110, atlas110.objects.countries);
const drawn = fc110.features.filter((f) => !SKIP_A3.has(f.properties.a3));
const frame = { type: "FeatureCollection", features: drawn };
const projection = geoEqualEarth().fitWidth(WIDTH, frame);
const pathOf = geoPath(projection).digits(DIGITS);
const [[, y0], [, y1]] = pathOf.bounds(frame);
const HEIGHT = Math.ceil(y1 - y0 + 2);
projection.translate([projection.translate()[0], projection.translate()[1] - y0 + 1]);

const round = (v) => Math.round(v * 10) / 10;
const project = ([lon, lat]) => projection([lon, lat]).map(round);
/** Points near the antimeridian can fall a few pixels outside the fitted frame: keep them on the map. */
const clampPoint = ([x, y]) => [Math.min(WIDTH - 2, Math.max(2, x)), Math.min(HEIGHT - 2, Math.max(2, y))];

const shapes = [];
const seen = new Set();
for (const f of drawn) {
  const code = codeOf(f.properties.a3);
  const d = pathOf(f);
  if (!d) continue;
  const [cx, cy] = project(geoCentroid(largestPolygon(f)));
  shapes.push({ code, name: f.properties.name, d, cx, cy });
  if (code) seen.add(code);
}
shapes.sort((a, b) => (a.code ?? "~").localeCompare(b.code ?? "~") || a.name.localeCompare(b.name));

const points = [];
const fc50 = topojson.feature(atlas50, atlas50.objects.countries);
for (const f of fc50.features) {
  const code = codeOf(f.properties.a3);
  if (!code || seen.has(code) || SKIP_A3.has(f.properties.a3) || points.some((p) => p.code === code)) continue;
  const [x, y] = clampPoint(project(geoCentroid(largestPolygon(f))));
  points.push({ code, x, y });
}
for (const [code, lonLat] of Object.entries(MANUAL_POINTS)) {
  if (seen.has(code) || points.some((p) => p.code === code)) continue;
  const [x, y] = clampPoint(project(lonLat));
  points.push({ code, x, y });
}
points.sort((a, b) => a.code.localeCompare(b.code));

const aspect = WIDTH / HEIGHT;
const regions = REGIONS.map(([id, label, [w, s, e, n]]) => {
  const xs = [];
  const ys = [];
  for (let i = 0; i <= 20; i++) {
    const lon = w + ((e - w) * i) / 20;
    const lat = s + ((n - s) * i) / 20;
    for (const p of [[lon, s], [lon, n], [w, lat], [e, lat]]) {
      const [x, y] = projection(p);
      xs.push(x);
      ys.push(y);
    }
  }
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let yy0 = Math.min(...ys);
  let yy1 = Math.max(...ys);
  // Same aspect ratio as the whole map, so a preset fills the frame without letterboxing.
  const bw = x1 - x0;
  const bh = yy1 - yy0;
  if (bw / bh > aspect) {
    const nh = bw / aspect;
    yy0 -= (nh - bh) / 2;
    yy1 = yy0 + nh;
  } else {
    const nw = bh * aspect;
    x0 -= (nw - bw) / 2;
    x1 = x0 + nw;
  }
  // Inside the map whenever the box fits (Oceania would otherwise show empty space past the right edge).
  const boxW = x1 - x0;
  const boxH = yy1 - yy0;
  if (boxW <= WIDTH) x0 = Math.min(Math.max(0, x0), WIDTH - boxW);
  if (boxH <= HEIGHT) yy0 = Math.min(Math.max(0, yy0), HEIGHT - boxH);
  return { id, label, box: [round(x0), round(yy0), round(boxW), round(boxH)] };
});

const allCodes = Object.keys(countries.getAlpha2Codes()).concat("XK").sort();
const missing = allCodes.filter((c) => !seen.has(c) && !points.some((p) => p.code === c));

const lines = [];
lines.push("// GENERATED by scripts/geo/build-world-map.mjs: do not edit by hand. Natural Earth (public domain) via");
lines.push("// visionscarto-world-atlas 1.0.0 (BSD-3-Clause), Equal Earth projection. docs/architecture/admin-world-map.md");
lines.push("");
lines.push("export type WorldShape = { code: string | null; name: string; d: string; cx: number; cy: number };");
lines.push("export type WorldPoint = { code: string; x: number; y: number };");
lines.push("export type WorldRegion = { id: string; label: string; box: [number, number, number, number] };");
lines.push("");
lines.push(`export const WORLD_WIDTH = ${WIDTH};`);
lines.push(`export const WORLD_HEIGHT = ${HEIGHT};`);
lines.push("");
lines.push("/** Country outlines (1:110m). code = ISO 3166-1 alpha-2 as sent by Cloudflare; null = no country code. */");
lines.push("export const WORLD_SHAPES: WorldShape[] = [");
for (const s of shapes) lines.push(`  ${JSON.stringify(s)},`);
lines.push("];");
lines.push("");
lines.push("/** Territories too small for the outlines: drawn as points (centre of the largest island). */");
lines.push("export const WORLD_POINTS: WorldPoint[] = [");
for (const p of points) lines.push(`  ${JSON.stringify(p)},`);
lines.push("];");
lines.push("");
lines.push("/** Region presets: viewBox [x, y, width, height] with the aspect ratio of the whole map. */");
lines.push("export const WORLD_REGIONS: WorldRegion[] = [");
for (const r of regions) lines.push(`  ${JSON.stringify(r)},`);
lines.push("];");
lines.push("");
lines.push(`/** ISO codes with neither an outline nor a point (listed in the table only). */`);
lines.push(`export const WORLD_UNMAPPED: string[] = ${JSON.stringify(missing)};`);
lines.push("");

const out = path.join(process.cwd(), "apps/admin/components/analytics/world/geo.generated.ts");
writeFileSync(out, lines.join("\n"));
const bytes = Buffer.byteLength(lines.join("\n"));
console.log(`shapes ${shapes.length} (codes ${seen.size}), points ${points.length}, unmapped ${missing.length} [${missing.join(",")}], ${WIDTH}x${HEIGHT}, ${(bytes / 1024).toFixed(0)} KiB -> ${path.relative(process.cwd(), out)}`);
