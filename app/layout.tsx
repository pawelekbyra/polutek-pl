import Providers from "@/app/components/Providers";
import ClerkLocalizationProvider from "@/app/components/ClerkLocalizationProvider";
import ReferralTracker from "@/app/components/ReferralTracker";
import { Suspense } from 'react';
import "./globals.css";

export const metadata = {
  title: "polutek.pl",
  description: "POLUTEK.PL — niezależna platforma wideo z materiałami publicznymi, dla zalogowanych i patronackimi."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className="font-vars"
      suppressHydrationWarning
    >
      <body className="font-sans bg-gray-50 text-gray-900 min-h-screen relative" suppressHydrationWarning>
        <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
          <Providers>
            <ClerkLocalizationProvider>
              <Suspense fallback={null}>
                <ReferralTracker />
              </Suspense>
              {children}
            </ClerkLocalizationProvider>
          </Providers>
        </Suspense>
      </body>
    </html>
  );
}
