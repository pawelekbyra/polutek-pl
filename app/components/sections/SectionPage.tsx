import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";
import { isLocale } from "@/lib/i18n/routing";
import { ensureSectionsEnabled } from "@/lib/sections/sections";
import PhotosFeed from "./PhotosFeed";
import ShopApp from "./ShopApp";

export type SectionPageProps = { params: Promise<{ locale: string }> };

/**
 * Shared shell of the prototype pages /zdjecia (/en/photos) and /sklep (/en/shop): 404 while the flag
 * SHOW_SECTION_NAV is off, and 404 on the wrong language's address (/en/zdjecia, /pl/photos).
 */
export default async function SectionPage({ params, section, polishAddress }: SectionPageProps & { section: "photos" | "shop"; polishAddress: boolean }) {
  ensureSectionsEnabled();
  const { locale } = await params;
  // The Polish address (/zdjecia, /sklep) exists only for Polish, the English-named one for every other language.
  if (!isLocale(locale) || (locale === "pl") !== polishAddress) notFound();
  const session = await auth();
  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
      <div className="public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)]">
        <Navbar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-0 py-4 focus:outline-none sm:px-6 sm:py-8 lg:px-8">
          {section === "photos" ? <PhotosFeed /> : <ShopApp />}
        </main>
        <Footer />
      </div>
    </AuthSessionSeedProvider>
  );
}
