import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-6 font-sans">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center text-neutral-200">
            <span className="text-[120px] font-black leading-none select-none">404</span>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight mb-3">Nie znaleziono strony</h1>
        <p className="text-neutral-600 mb-8">
          Przepraszamy, ale strona której szukasz nie istnieje lub została przeniesiona pod inny adres.
        </p>

        <Link
            href="/"
            className="inline-block bg-[#1a1a1a] text-white px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98]"
        >
            Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
