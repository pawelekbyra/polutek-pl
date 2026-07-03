// Shared visual language for the PWA app icon (used by app/icon.tsx and
// app/icon-512/route.tsx) so the OS-generated launch icon/splash and our own
// animated SplashScreen read as one continuous, on-brand square icon instead
// of two mismatched screens.

export const APP_ICON_BACKGROUND = "#f7f1e4";
export const APP_ICON_INK = "#171717";

// Same deterministic "hand-drawn wobble" used by the site's <Frame> primitive
// (app/components/najs/primitives.tsx), reproduced here so the icon border
// reads as the same hand style as every other card/button on the site.
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
