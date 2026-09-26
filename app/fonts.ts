// The `geist` package ships the font files with the application, so builds stay
// deterministic and never depend on a remote font provider.
export { GeistSans as geistSans } from "geist/font/sans";
export { GeistMono as geistMono } from "geist/font/mono";

import localFont from "next/font/local";

// Montserrat Black powers the KUTASHI.COM wordmark logo (BrandName.tsx). The
// woff2 (latin subset — the logo is ASCII-only) is committed under app/fonts/
// (OFL license alongside it), so the build self-hosts it and never reaches
// out to a remote font provider. This previously loaded Space Grotesk Bold
// for an earlier text wordmark revision; that file is unused now but left in
// place (see space-grotesk-bold-latin.woff2) in case a future revision wants
// it back.
export const brandLogoFont = localFont({
  src: "./fonts/montserrat-black-latin.woff2",
  weight: "900",
  style: "normal",
  display: "swap",
  variable: "--font-brand-logo",
  fallback: ["sans-serif"],
});
