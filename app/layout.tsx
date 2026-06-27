import Providers from "@/app/components/Providers";
import ClerkLocalizationProvider from "@/app/components/ClerkLocalizationProvider";
import { Suspense } from 'react';
import { jakarta, outfit, spaceGrotesk } from "./fonts";
import "./globals.css";

import { APP_NAME } from '@/lib/constants';

export const metadata = {
  title: APP_NAME,
  description: `${APP_NAME} — niezależny kanał wideo z materiałami publicznymi, dla zalogowanych i patronackimi.`
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${jakarta.variable} ${outfit.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans bg-background text-foreground min-h-screen relative" suppressHydrationWarning>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Providers>
            <ClerkLocalizationProvider>
              {children}
            </ClerkLocalizationProvider>
          </Providers>
        </Suspense>
      </body>
    </html>
  );
}
