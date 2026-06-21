import Providers from "@/app/components/Providers";
import ClerkLocalizationProvider from "@/app/components/ClerkLocalizationProvider";
import { Suspense } from 'react';
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
    >
      <body className="font-sans bg-gray-50 text-gray-900 min-h-screen relative" suppressHydrationWarning>
        <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
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
