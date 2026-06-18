"use client";

import Link from "next/link";
import React from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-6 font-sans">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight mb-3">Coś poszło nie tak</h1>
        <p className="text-neutral-600 mb-8">
          Wystąpił nieoczekiwany błąd aplikacji. Nasz zespół został powiadomiony.
          Spróbuj odświeżyć stronę lub wrócić później.
        </p>

        {error.digest && (
          <div className="mb-8 p-3 bg-neutral-100 rounded-md">
            <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-1">Kod błędu (Digest)</p>
            <p className="text-sm font-mono text-neutral-600 break-all">{error.digest}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full bg-[#1a1a1a] text-white py-3 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98]"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="w-full bg-white border border-neutral-300 text-[#1a1a1a] py-3 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-neutral-50 transition-all active:scale-[0.98]"
          >
            Wróć do strony głównej
          </Link>
        </div>
      </div>
    </main>
  );
}
