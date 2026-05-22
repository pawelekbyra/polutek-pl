import Providers from "@/app/components/Providers";
import ClerkLocalizationProvider from "@/app/components/ClerkLocalizationProvider";
import ReferralTracker from "@/app/components/ReferralTracker";
import { Suspense } from 'react';
import { Inter, Outfit, Plus_Jakarta_Sans, Gluten, Space_Grotesk } from 'next/font/google';
import "./globals.css";

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit', weight: ['400', '500', '600', '700', '800', '900'] });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-jakarta', weight: ['400', '500', '600', '700', '800'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-space-grotesk' });
const gluten = Gluten({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-gluten' });

export const metadata = { title: "POLUTEK.PL", description: "A secret project that aims to change something big." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jakarta.variable} ${gluten.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
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
