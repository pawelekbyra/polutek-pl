import Providers from "@/app/components/Providers";
import ClerkLocalizationProvider from "@/app/components/ClerkLocalizationProvider";
import { Suspense } from 'react';
import { jakarta, outfit, spaceGrotesk, bebasNeue, kalam, patrickHand, caveat } from "./fonts";
import "./globals.css";

import { APP_NAME } from '@/lib/constants';
import { SplashScreen } from "@/app/components/SplashScreen";
import { ServiceWorkerRegistration } from "@/app/components/ServiceWorkerRegistration";
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: APP_NAME,
  description: `${APP_NAME} — niezależny kanał wideo z materiałami publicznymi, dla zalogowanych i patronackimi.`,
  manifest: "/manifest.json",
  themeColor: "#f7f1e4",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: '/icon-enter.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/icon-enter.svg'],
    apple: [
      { url: '/icon', type: 'image/png', sizes: '192x192' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${jakarta.variable} ${outfit.variable} ${spaceGrotesk.variable} ${bebasNeue.variable} ${kalam.variable} ${patrickHand.variable} ${caveat.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="application-name" content={APP_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="theme-color" content="#f7f1e4" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon" />
      </head>
      <body className="font-sans bg-background text-foreground min-h-[100dvh] relative" suppressHydrationWarning>
        <SplashScreen />
        <ServiceWorkerRegistration />
        <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
          <Providers>
            <ClerkLocalizationProvider>
              {children}
            </ClerkLocalizationProvider>
          </Providers>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
