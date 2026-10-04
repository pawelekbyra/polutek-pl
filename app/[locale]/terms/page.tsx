import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { TermsContentEn, LEGAL_EFFECTIVE_DATE_EN } from '@/app/components/legal/LegalDocs';
import { notFound } from 'next/navigation';
import { getLocaleAlternates, getLocalizedHref } from '@/lib/i18n/routing';
import { getBaseUrl } from '@/lib/utils';

// The document is the same for every visitor, so the page is rendered once and served from the
// cache (no per-request render, no `no-store`). Rendered at the first request, not at build time,
// so the runtime settings the root layout reads (sign-in keys) are the real ones; refreshed hourly.
export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata = {
  title: 'Terms of Service — WWW.PAWELPERFECT.COM',
  description: 'Terms of Service for WWW.PAWELPERFECT.COM: usage rules, voluntary support for the Creator, complaints.',
  alternates: getLocaleAlternates('en', 'terms', { baseUrl: getBaseUrl() }),
};

export default async function TermsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "en") notFound();
  return (
    <div className="min-h-screen bg-background text-[var(--chan-ink)]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b-2 border-[var(--chan-ink)]/10 pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Terms of Service — WWW.PAWELPERFECT.COM</h1>
          <p className="mt-2 text-sm text-[var(--chan-muted)]">{LEGAL_EFFECTIVE_DATE_EN}</p>
          <p className="mt-1 text-sm text-[var(--chan-muted)]">
            This is a translation provided for convenience. In case of any discrepancy, the Polish-language version
            of the Terms is legally binding.
          </p>
        </header>

        <TermsContentEn />

        <div className="mt-20 border-t border-[var(--chan-ink)]/10 pt-10">
          <Link href={getLocalizedHref("en", "home")} className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-colors hover:text-primary">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
            Back to homepage
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
