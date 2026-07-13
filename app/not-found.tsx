import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 font-sans text-foreground">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center text-border">
          <span className="select-none text-[120px] font-black leading-none">404</span>
        </div>
        <h1 className="mb-3 text-2xl font-black uppercase tracking-tight text-foreground">Nie znaleziono strony</h1>
        <p className="mb-8 text-muted-foreground">
          Przepraszamy, ale strona której szukasz nie istnieje lub została przeniesiona pod inny adres.
        </p>

        <Link
          href="/"
          className="inline-block rounded-full bg-primary px-8 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
