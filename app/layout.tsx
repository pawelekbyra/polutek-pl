import Providers from "@/app/components/Providers";
import AuthLifecycleProvider from "@/app/components/auth/AuthLifecycleProvider";
import { AuthPublicConfigProvider } from "@/lib/auth/public-config";
import { readPublicAuthConfig } from "@/lib/auth/public-config.server";
import type { Metadata, Viewport } from "next";
import { Suspense } from 'react';
import { geistMono, geistSans } from "./fonts";
import "./globals.css";

import { APP_NAME, SITE_TITLE } from '@/lib/constants';
import { getBetaSiteText, getStageRobots } from "@/lib/site-stage-metadata";
import { ServiceWorkerCleanup } from "@/app/components/ServiceWorkerCleanup";
import { ZoomLock } from "@/app/components/ZoomLock";
import { UrlMask } from "@/app/components/UrlMask";
import { resolveDocumentLanguage } from "@/lib/i18n/server-language";
import { loadCatalog } from "@/lib/i18n/catalog";
import { htmlLang } from "@/lib/i18n/ui";
import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";
import { TelemetryBeacon } from "@/app/components/telemetry/TelemetryBeacon";
import { isTelemetryBeaconEnabled } from "@/lib/telemetry/config";
import { GATE_BOOT_SCRIPT } from "@/app/components/preload/matrix-rain-engine";
import { COMMENT_DEEP_LINK_CAPTURE_SCRIPT } from "@/app/components/comments/deep-link";

export async function generateMetadata(): Promise<Metadata> {
  const betaText = await getBetaSiteText(await resolveDocumentLanguage());
  return {
    title: betaText?.title ?? SITE_TITLE,
    applicationName: APP_NAME,
    // Beta: neutral localized description. After launch: the original fixed text.
    description: betaText?.description ?? `${APP_NAME}: niezależny kanał wideo twórcy, filmy publiczne i dla zalogowanych.`,
    // Beta: noindex, nofollow (the X-Robots-Tag header in next.config.mjs says the same for every page).
    robots: getStageRobots(),
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: SITE_TITLE,
    },
    // The site's icon is the owner's sunglasses logo (public/icon-glasses*.svg|png|ico, from logo-glasses.svg): a vector
    // for browsers that take SVG (light on dark tabs), PNG and ICO fallbacks, and the 180 px
    // home-screen icon iOS asks for (solid background: iOS paints transparency black). The rabbit
    // is only the entry gate's picture, not an icon.
    icons: {
      icon: [
        { url: '/icon-glasses.svg', type: 'image/svg+xml', sizes: 'any' },
        { url: '/icon-glasses-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/icon-glasses.ico', sizes: 'any' },
      ],
      shortcut: ['/icon-glasses-32.png'],
      apple: [
        { url: '/icon-glasses-180.png', type: 'image/png', sizes: '180x180' },
      ],
    },
  };
}

// Next emits the one viewport and theme-color tag from here (a `themeColor` inside `metadata` is
// deprecated, and a hand-written <head> duplicated both tags).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The site behaves like an app: no pinch or double-tap zoom (see also ZoomLock, for iOS Safari,
  // which ignores these two values).
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f7f9fc",
  // The site is light only; saying so keeps form controls and scrollbars consistent.
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLanguage = await resolveDocumentLanguage();
  const initialCatalog = await loadCatalog(initialLanguage);
  const publicAuthConfig = readPublicAuthConfig();
  return (
    <html
      lang={htmlLang(initialLanguage)}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ background: "#f7f9fc" }}
    >
      <head>
        {/* Entry gate: hides it before the first paint for a viewer who already entered in this
            tab, otherwise draws the Matrix rain the moment its canvas is parsed (pre-hydration).
            Inline on purpose (the CSP allows inline scripts); Next merges its own metadata tags
            (viewport, manifest, icons) into this <head>. */}
        <script dangerouslySetInnerHTML={{ __html: GATE_BOOT_SCRIPT }} />
        {/* Writes down a #comment-... target before the address is rewritten (see comments/deep-link.ts). */}
        <script dangerouslySetInnerHTML={{ __html: COMMENT_DEEP_LINK_CAPTURE_SCRIPT }} />
      </head>
      <body className="font-sans bg-background text-foreground min-h-[100dvh] relative" suppressHydrationWarning>
        <ServiceWorkerCleanup />
        <ZoomLock />
        <UrlMask />
        <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
          <Providers initialLanguage={initialLanguage} initialCatalog={initialCatalog}>
            <AuthPublicConfigProvider value={publicAuthConfig}>
              <AuthLifecycleProvider>
                <AuthModalProvider>
                  {children}
                </AuthModalProvider>
                <TelemetryBeacon enabled={isTelemetryBeaconEnabled()} />
              </AuthLifecycleProvider>
            </AuthPublicConfigProvider>
          </Providers>
        </Suspense>
      </body>
    </html>
  );
}
