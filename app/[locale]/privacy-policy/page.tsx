import React from 'react';
import { APP_NAME } from '@/lib/constants';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { PrivacyContentEn, LEGAL_EFFECTIVE_DATE_EN } from '@/app/components/legal/LegalDocs';
import { notFound } from 'next/navigation';
import { getLocalizedHref } from '@/lib/i18n/routing';

export const metadata = {
  title: APP_NAME,
  description: `Privacy Policy for ${APP_NAME}: what data we collect, why, and what rights you have.`,
};

export default async function PrivacyPolicyPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "en") notFound();
  return (
    <div className="min-h-screen bg-background text-[var(--chan-ink)]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b-2 border-[var(--chan-ink)]/10 pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Privacy Policy — {APP_NAME}</h1>
          <p className="mt-2 text-sm text-[var(--chan-muted)]">{LEGAL_EFFECTIVE_DATE_EN}</p>
          <p className="mt-1 text-sm text-[var(--chan-muted)]">
            This is a translation provided for convenience. In case of any discrepancy, the Polish-language version
            of the Privacy Policy is legally binding.
          </p>
        </header>

        <PrivacyContentEn />

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
