import Providers from "@/app/components/Providers";
import AuthLifecycleProvider from "@/app/components/auth/AuthLifecycleProvider";
import { AuthPublicConfigProvider } from "@/lib/auth/public-config";
import { readPublicAuthConfig } from "@/lib/auth/public-config.server";
import { Suspense } from 'react';
import { geistMono, geistSans } from "./fonts";
import "./globals.css";

import { APP_NAME } from '@/lib/constants';
import { ServiceWorkerCleanup } from "@/app/components/ServiceWorkerCleanup";
import { UrlMask } from "@/app/components/UrlMask";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";
import { TelemetryBeacon } from "@/app/components/telemetry/TelemetryBeacon";
import { isTelemetryBeaconEnabled } from "@/lib/telemetry/config";
import { GATE_BOOT_SCRIPT } from "@/app/components/preload/matrix-rain-engine";

export const metadata = {
  title: APP_NAME,
  description: `${APP_NAME} — niezależny kanał wideo z materiałami publicznymi, dla zalogowanych i patronackimi.`,
  manifest: "/manifest.json",
  themeColor: "#f7f9fc",
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLanguage = await resolveInitialLanguage();
  const publicAuthConfig = readPublicAuthConfig();
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || 'development';
  return (
    <html
      lang={initialLanguage}
      suppressHydrationWarning
      data-build-id={buildId}
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ background: "#f7f9fc" }}
    >
      <head>
        {/* Entry gate: hides it before the first paint for a viewer who already entered in this
            tab, otherwise draws the Matrix rain the moment its canvas is parsed (pre-hydration). */}
        <script dangerouslySetInnerHTML={{ __html: GATE_BOOT_SCRIPT }} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="application-name" content={APP_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="theme-color" content="#f7f9fc" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon" />
      </head>
      <body className="font-sans bg-background text-foreground min-h-[100dvh] relative" suppressHydrationWarning>
        <ServiceWorkerCleanup />
        <UrlMask />
        <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
          <Providers initialLanguage={initialLanguage}>
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
