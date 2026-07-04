import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center paper-surface px-6 font-sans ink-text">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center text-[var(--najs-paper-line)]">
          <span className="select-none text-[120px] font-black leading-none">404</span>
        </div>
        <h1 className="mb-3 text-2xl font-black uppercase tracking-tight ink-text">Nie znaleziono strony</h1>
        <p className="mb-8 muted-text">
          Przepraszamy, ale strona której szukasz nie istnieje lub została przeniesiona pod inny adres.
        </p>

        <Link
          href="/"
          className="inline-block rounded-full ink-button px-8 py-3 text-xs font-bold uppercase tracking-widest text-[var(--najs-paper)] transition-all hover:bg-[rgba(23,23,23,0.9)] active:scale-[0.98]"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
