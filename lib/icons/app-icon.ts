// Shared visual language for the PWA app icon (used by app/icon.tsx and
// app/icon-512/route.tsx) so the OS-generated launch icon and the SVG favicon
// (public/icon-brand.svg) read as one continuous, on-brand square icon.

export const APP_ICON_BACKGROUND = "#f7f9fc";
export const APP_ICON_INK = "#111827";
// Brand accent — the primary action color used by the site's buttons and logo.
export const APP_ICON_BLUE = "#7c3aed";

// Stable, deterministic contour variation for the launcher icon border.
function wobble(seed: number, i: number, amp = 1.4) {
  const n = Math.sin(seed * 701 + i * 89.7) * 10000;
  return (n - Math.floor(n) - 0.5) * amp;
}

export function roundedSquarePath(size: number, radius: number, seed: number, inset: number) {
  const l = inset + wobble(seed, 1) * (size / 192);
  const t = inset + wobble(seed, 2) * (size / 192);
  const r = size - inset + wobble(seed, 3) * (size / 192);
  const b = size - inset + wobble(seed, 4) * (size / 192);
  const rad = Math.min(radius, (r - l) / 2 - 1, (b - t) / 2 - 1);
  return `M ${l + rad} ${t} Q ${l} ${t} ${l} ${t + rad} L ${l} ${b - rad} Q ${l} ${b} ${l + rad} ${b} L ${r - rad} ${b} Q ${r} ${b} ${r} ${b - rad} L ${r} ${t + rad} Q ${r} ${t} ${r - rad} ${t} Z`;
}

// Base64-encoded, transparent-background, palette-quantized PNG rasterization of the
// site's glasses logo mark (public/logo-glasses.svg, trimmed to its visible bounding box —
// 480x116, aspect ratio 4.1379). Embedded as a data URI (not fetched from /public) so the
// edge-runtime ImageResponse routes below (app/icon.tsx, app/icon-512/route.tsx) can render
// it via <img src=... /> without filesystem access. Replaces the earlier "Enter/Return" (↵)
// glyph mark (owner decision, 2026-08-01) now that the glasses graphic is the site's logo.
export const GLASSES_MARK_DATA_URI =
  "data:image/png;base64,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";
export const GLASSES_MARK_ASPECT_RATIO = 480 / 116;

// Returns the {x,y,width,height} placement for the glasses mark centered inside a
// `canvas`x`canvas` square, occupying `widthFraction` of the canvas width and letterboxed
// vertically (the source mark is a wide, short lockup, not a square glyph).
export function glassesMarkRect(canvas: number, widthFraction = 0.72) {
  const width = canvas * widthFraction;
  const height = width / GLASSES_MARK_ASPECT_RATIO;
  return {
    width,
    height,
    x: (canvas - width) / 2,
    y: (canvas - height) / 2,
  };
}
