import localFont from "next/font/local";

/**
 * The one typeface of the entry gate ("Follow the white rabbit" and the button caption).
 * To try another font, swap this file's `src` (keep the subset small) and nothing else: the gate
 * CSS only reads `var(--font-gate)`.
 *
 * Major Mono Display (Emre Parlak, SIL OFL 1.1, see OFL-major-mono-display.txt), subset to ASCII,
 * the ellipsis/dashes/quotes and the Polish letters: one 5 KB woff2. Declared in the home route's
 * layout, so it is preloaded only there, where it is the first text a visitor sees.
 */
export const gateFont = localFont({
  src: "./major-mono-display-gate.woff2",
  variable: "--font-gate",
  weight: "400",
  display: "swap",
  preload: true,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "Courier New", "monospace"],
});
