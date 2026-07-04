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
    <main className="flex min-h-screen items-center justify-center bg-[#f8f3e7] px-6 font-sans text-[#171717]">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>
        <h1 className="mb-3 text-2xl font-black uppercase tracking-tight text-[#171717]">Coś poszło nie tak</h1>
        <p className="mb-8 text-[#6b665d]">
          Wystąpił nieoczekiwany błąd aplikacji. Nasz zespół został powiadomiony.
          Spróbuj odświeżyć stronę lub wrócić później.
        </p>

        {error.digest && (
          <div className="mb-8 rounded-2xl border border-[#d8d0bd]/90 bg-[#f1ead9]/70 p-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#6b665d]">Kod błędu (Digest)</p>
            <p className="break-all font-mono text-sm text-[#3f3a33]">{error.digest}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full rounded-full bg-[#171717] py-3 text-xs font-bold uppercase tracking-widest text-[#f8f3e7] transition-all hover:bg-[#171717]/90 active:scale-[0.98]"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="w-full rounded-full border border-[#d8d0bd]/90 bg-[#f8f3e7] py-3 text-xs font-bold uppercase tracking-widest text-[#171717] transition-all hover:bg-[#f1ead9] active:scale-[0.98]"
          >
            Wróć do strony głównej
          </Link>
        </div>
      </div>
    </main>
  );
}
