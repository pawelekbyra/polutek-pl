// Shared visual language for the PWA app icon (used by app/icon.tsx and
// app/icon-512/route.tsx) so the OS-generated launch icon/splash and our own
// animated SplashScreen read as one continuous, on-brand square icon instead
// of two mismatched screens.

export const APP_ICON_BACKGROUND = "#f7f9fc";
export const APP_ICON_INK = "#111827";
// Brand blue — the primary action accent used by the site's buttons and logo.
export const APP_ICON_BLUE = "#2563eb";

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

// The single source of truth for the "Enter / Return" glyph (↵) — a clean line-art
// return arrow: a vertical riser on the right, a rounded corner, then a horizontal
// stroke left into a left-pointing arrowhead. Rendered identically by the OS launch
// icon (app/icon.tsx, app/icon-512), the SVG favicon (public/icon-enter.svg) and the
// in-app SplashScreen, so the native PWA splash hands off to our splash on the exact
// same mark. Coordinates come from a normalized 100×100 box scaled into `canvas`,
// centered, so the glyph stays dead-centre at every size.
export function enterGlyphPaths(canvas: number): { main: string; head1: string; head2: string; strokeWidth: number } {
  const box = canvas * 0.5; // glyph occupies the centre half of the icon
  const off = (canvas - box) / 2;
  const s = box / 100;
  const P = (x: number, y: number) => `${(off + x * s).toFixed(2)} ${(off + y * s).toFixed(2)}`;

  // Normalized 100×100 return-arrow: riser at x=76 (y 22→58), rounded corner,
  // horizontal to x=24 at y=64, then an arrowhead pointing left.
  const main = `M ${P(76, 22)} L ${P(76, 58)} Q ${P(76, 64)} ${P(70, 64)} L ${P(24, 64)}`;
  const head1 = `M ${P(24, 64)} L ${P(41, 50)}`;
  const head2 = `M ${P(24, 64)} L ${P(41, 78)}`;

  return { main, head1, head2, strokeWidth: Math.max(2, canvas * 0.05) };
}

// Filled "Enter / Return" key glyph (↵) — a solid, chunky L-shaped return arrow: a tall
// riser on the right, a rounded elbow, a horizontal bar running left, ending in a big
// left-pointing arrowhead. Rendered as a single closed polygon so it can be *filled*
// (brand blue) with a bold outline that stays legible at launcher-icon sizes.
// Coordinates come from a normalized 100×100 box scaled into `canvas` and centered, so
// the mark stays dead-centre at any size (splash, favicon, PWA launch icon).
export function enterGlyphFilledPath(canvas: number): { path: string; strokeWidth: number } {
  const box = canvas * 0.62; // filled mark reads best slightly larger than the line-art one
  const off = (canvas - box) / 2;
  const s = box / 100;
  const P = (x: number, y: number) => `${(off + x * s).toFixed(2)} ${(off + y * s).toFixed(2)}`;

  // Outline walked clockwise from the top-right of the riser. The riser occupies x 60→78,
  // the horizontal bar y 52→70, and the arrowhead is a triangle with its tip at the left.
  const path = [
    `M ${P(78, 15)}`,   // top-right of riser
    `L ${P(78, 70)}`,   // down the right edge to the bottom bar
    `L ${P(40, 70)}`,   // left along the bottom edge to the arrowhead base
    `L ${P(40, 82)}`,   // down to the arrowhead's bottom corner
    `L ${P(8, 61)}`,    // to the arrowhead tip (pointing left)
    `L ${P(40, 40)}`,   // up to the arrowhead's top corner
    `L ${P(40, 52)}`,   // in to the top edge of the horizontal bar
    `L ${P(60, 52)}`,   // right along the top edge to the inner elbow
    `L ${P(60, 15)}`,   // up the inner edge of the riser
    "Z",
  ].join(" ");

  return { path, strokeWidth: Math.max(2, canvas * 0.045) };
}
