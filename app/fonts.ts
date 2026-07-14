// The `geist` package ships the font files with the application, so builds stay
// deterministic and never depend on a remote font provider.
export { GeistSans as geistSans } from "geist/font/sans";
export { GeistMono as geistMono } from "geist/font/mono";

import localFont from "next/font/local";

// Bowlby One SC powers the wordmark logo. The woff2 (latin subset — the logo is
// ASCII-only) is committed under app/fonts/, so the build self-hosts it and
// never reaches out to a remote font provider.
export const brandLogoFont = localFont({
  src: "./fonts/bowlby-one-sc-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-brand-logo",
  fallback: ["sans-serif"],
});
