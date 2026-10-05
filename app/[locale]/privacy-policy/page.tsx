import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { PrivacyContentEn, LEGAL_EFFECTIVE_DATE_EN } from '@/app/components/legal/LegalDocs';
import { notFound } from 'next/navigation';
import { getLocaleAlternates, getLocalizedHref, isLocale } from '@/lib/i18n/routing';
import { getServerTx } from '@/lib/i18n/server-tx';
import { getBaseUrl } from '@/lib/utils';
import { htmlLang } from '@/lib/i18n/ui';

// The document is the same for every visitor, so the page is rendered once and served from the
// cache (no per-request render, no `no-store`). Rendered at the first request, not at build time,
// so the runtime settings the root layout reads (sign-in keys) are the real ones; refreshed hourly.
export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata = {
  title: 'Privacy Policy — WWW.PAWELPERFECT.COM',
  description: 'Privacy Policy for WWW.PAWELPERFECT.COM: what data we collect, why, and what rights you have.',
  alternates: getLocaleAlternates('en', 'privacy', { baseUrl: getBaseUrl() }),
};

export default async function PrivacyPolicyPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  // English, and the interface-only languages (de, es, ...), which show the English document.
  if (!isLocale(locale) || locale === "pl") notFound();
  const tx = await getServerTx(locale);
  return (
    <div className="min-h-screen bg-background text-[var(--chan-ink)]">
      <Navbar />
      <main id="main" tabIndex={-1} lang="en" className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b-2 border-[var(--chan-ink)]/10 pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Privacy Policy — WWW.PAWELPERFECT.COM</h1>
          <p className="mt-2 text-sm text-[var(--chan-muted)]">{LEGAL_EFFECTIVE_DATE_EN}</p>
          <p className="mt-1 text-sm text-[var(--chan-muted)]">
            This is a translation provided for convenience. In case of any discrepancy, the Polish-language version
            of the Privacy Policy is legally binding.
          </p>
          {locale !== "en" ? (
            <p lang={htmlLang(locale)} className="mt-3 rounded-lg bg-[var(--chan-surface)] px-3 py-2 text-sm text-[var(--chan-muted)]">
              {tx("Dokument jest dostępny po polsku i angielsku.", "The document is available in English and Polish.")}
            </p>
          ) : null}
        </header>

        <PrivacyContentEn />

        <div className="mt-20 border-t border-[var(--chan-ink)]/10 pt-10">
          <Link href={getLocalizedHref(locale, "home")} className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-colors hover:text-primary">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
            Back to homepage
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
