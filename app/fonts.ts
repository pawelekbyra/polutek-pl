// The `geist` package ships the font files with the application, so builds stay
// deterministic and never depend on a remote font provider.
export { GeistSans as geistSans } from "geist/font/sans";

import localFont from "next/font/local";

// Geist Mono is the same file the `geist` package exports, declared here only to turn off its
// preload: on the public pages it sets just the small duration badges, so it must not compete
// with the page's scripts and the video for bandwidth on the first load (it still loads with
// `display: swap` wherever it is used).
export const geistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  preload: false,
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  weight: "100 900",
});
