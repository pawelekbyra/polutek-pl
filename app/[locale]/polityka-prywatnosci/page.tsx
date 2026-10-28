import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { PolitykaContent, LEGAL_EFFECTIVE_DATE } from '@/app/components/legal/LegalDocs';
import { notFound } from 'next/navigation';
import { getLocaleAlternates, getLocalizedHref } from '@/lib/i18n/routing';
import { getBaseUrl } from '@/lib/utils';

// The document is the same for every visitor, so the page is rendered once and served from the
// cache (no per-request render, no `no-store`). Rendered at the first request, not at build time,
// so the runtime settings the root layout reads (sign-in keys) are the real ones; refreshed hourly.
export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata = {
  title: 'Polityka prywatności WWW.PAWELPERFECT.COM',
  description: 'Polityka prywatności serwisu WWW.PAWELPERFECT.COM: jakie dane zbieramy, po co i jakie masz prawa.',
  alternates: getLocaleAlternates('pl', 'privacy', { baseUrl: getBaseUrl() }),
};

export default async function PolitykaPrywatnosciPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "pl") notFound();
  return (
    <div className="min-h-screen bg-background text-[var(--chan-ink)]">
      <Navbar />
      <main id="main" tabIndex={-1} lang="pl" className="mx-auto max-w-3xl px-4 py-16 focus:outline-none">
        <header className="mb-10 border-b-2 border-[var(--chan-ink)]/10 pb-8">
          <h1 className="text-[clamp(1.25rem,5.4vw,1.875rem)] font-black uppercase tracking-tighter [overflow-wrap:anywhere]">Polityka prywatności WWW.PAWELPERFECT.COM</h1>
          <p className="mt-2 text-sm text-[var(--chan-muted)]">{LEGAL_EFFECTIVE_DATE}</p>
        </header>

        <PolitykaContent />

        <div className="mt-20 border-t border-[var(--chan-ink)]/10 pt-10">
          <Link href={getLocalizedHref("pl", "home")} className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-colors hover:text-primary">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
            Wróć na stronę główną
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
