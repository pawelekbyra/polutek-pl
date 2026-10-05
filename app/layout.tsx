import Providers from "@/app/components/Providers";
import AuthLifecycleProvider from "@/app/components/auth/AuthLifecycleProvider";
import { AuthPublicConfigProvider } from "@/lib/auth/public-config";
import { readPublicAuthConfig } from "@/lib/auth/public-config.server";
import type { Viewport } from "next";
import { Suspense } from 'react';
import { geistMono, geistSans } from "./fonts";
import "./globals.css";

import { APP_NAME } from '@/lib/constants';
import { ServiceWorkerCleanup } from "@/app/components/ServiceWorkerCleanup";
import { UrlMask } from "@/app/components/UrlMask";
import { resolveDocumentLanguage } from "@/lib/i18n/server-language";
import { loadCatalog } from "@/lib/i18n/catalog";
import { htmlLang } from "@/lib/i18n/ui";
import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";
import { TelemetryBeacon } from "@/app/components/telemetry/TelemetryBeacon";
import { isTelemetryBeaconEnabled } from "@/lib/telemetry/config";

export const metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  description: `${APP_NAME}: niezależny kanał wideo twórcy, filmy publiczne i dla zalogowanych.`,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  // Small copies of the rabbit (the 500 px, 105 KB original is only the gate image): a 32 px tab
  // icon and the 180 px home-screen icon iOS asks for.
  icons: {
    icon: [
      { url: '/rabbit-32.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: ['/rabbit-32.png'],
    apple: [
      { url: '/rabbit-180.png', type: 'image/png', sizes: '180x180' },
    ],
  },
};

// Next emits the one viewport and theme-color tag from here (a `themeColor` inside `metadata` is
// deprecated, and a hand-written <head> duplicated both tags).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body className="font-sans bg-background text-foreground min-h-[100dvh] relative" suppressHydrationWarning>
        <ServiceWorkerCleanup />
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
