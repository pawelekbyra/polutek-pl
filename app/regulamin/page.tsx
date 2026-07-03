import React from 'react';
import { APP_NAME } from '@/lib/constants';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';
import { RegulaminContent, LEGAL_EFFECTIVE_DATE } from '@/app/components/legal/LegalDocs';

export const metadata = {
  title: `Regulamin — ${APP_NAME}`,
  description: `Regulamin serwisu ${APP_NAME}: zasady korzystania, wsparcie twórcy, dostęp do Strefy Fenkju, reklamacje.`,
};

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-background text-[#1a1a1a]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b-2 border-[#1a1a1a]/10 pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Regulamin serwisu {APP_NAME}</h1>
          <p className="mt-2 text-sm text-[#7a7a7a]">{LEGAL_EFFECTIVE_DATE}</p>
        </header>

        <RegulaminContent />

        <div className="mt-20 border-t border-[#1a1a1a]/10 pt-10">
          <Link href="/" className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-colors hover:text-primary">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
            Wróć na stronę główną
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
