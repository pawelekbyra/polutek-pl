// Shared visual language for the PWA app icon (used by app/icon.tsx and
// app/icon-512/route.tsx) so the OS-generated launch icon/splash and our own
// animated SplashScreen read as one continuous, on-brand square icon instead
// of two mismatched screens.

export const APP_ICON_BACKGROUND = "#f7f1e4";
export const APP_ICON_INK = "#171717";

const PATRICK_HAND_FONT_URL =
  "https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf";

let cachedFont: ArrayBuffer | null = null;

export async function loadPatrickHandFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const res = await fetch(PATRICK_HAND_FONT_URL);
  if (!res.ok) throw new Error(`Failed to load icon font: ${res.status}`);
  cachedFont = await res.arrayBuffer();
  return cachedFont;
}

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
