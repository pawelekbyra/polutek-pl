import React from 'react';
import { APP_NAME } from '@/lib/constants';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { RegulaminContent, LEGAL_EFFECTIVE_DATE } from '@/app/components/legal/LegalDocs';
import { notFound } from 'next/navigation';
import { getLocalizedHref } from '@/lib/i18n/routing';

export const metadata = {
  title: `Regulamin — ${APP_NAME}`,
  description: `Regulamin serwisu ${APP_NAME}: zasady korzystania, wsparcie twórcy, dostęp do Strefy Fenkju, reklamacje.`,
};

export default async function RegulaminPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  if (locale !== "pl") notFound();
  return (
    <div className="min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b border-[var(--chan-line)] pb-8">
          <h1 className="font-brand text-3xl font-bold tracking-tight">Regulamin serwisu {APP_NAME}</h1>
          <p className="mt-2 text-sm text-[var(--chan-muted)]">{LEGAL_EFFECTIVE_DATE}</p>
        </header>

        <RegulaminContent />

        <div className="mt-20 border-t border-[var(--chan-line)] pt-10">
          <Link href={getLocalizedHref("pl", "home")} className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-colors hover:text-[#2563EB]">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
            Wróć na stronę główną
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
