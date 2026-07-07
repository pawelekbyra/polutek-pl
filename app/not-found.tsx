import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--chan-nav)] px-6 font-sans text-[var(--chan-ink)]">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center text-[var(--chan-line)]">
          <span className="font-brand select-none text-[120px] font-bold leading-none">404</span>
        </div>
        <h1 className="font-brand mb-3 text-2xl font-bold tracking-tight text-[var(--chan-ink)]">Nie znaleziono strony</h1>
        <p className="mb-8 text-[var(--chan-muted)]">
          Przepraszamy, ale strona której szukasz nie istnieje lub została przeniesiona pod inny adres.
        </p>

        <Link
          href="/"
          className="font-brand inline-block rounded-full bg-[var(--chan-ink)] px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
