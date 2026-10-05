"use client";

import Link from "next/link";
import React from "react";
import { useOptionalTx } from "@/lib/i18n/language-context";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tx = useOptionalTx();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 font-sans text-foreground">
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
        <h1 className="mb-3 text-2xl font-black uppercase tracking-tight text-foreground">{tx("Coś poszło nie tak", "Something went wrong")}</h1>
        <p className="mb-8 text-muted-foreground">
          {tx("Wystąpił nieoczekiwany błąd aplikacji. Spróbuj odświeżyć stronę lub wrócić później.", "An unexpected application error occurred. Try refreshing the page or come back later.")}
        </p>

        {error.digest && (
          <div className="mb-8 rounded-2xl border border-border bg-secondary p-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{tx("Kod błędu (Digest)", "Error code (Digest)")}</p>
            <p className="break-all font-mono text-sm text-foreground">{error.digest}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full rounded-full bg-primary py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {tx("Spróbuj ponownie", "Try again")}
          </button>
          <Link
            href="/"
            className="w-full rounded-full border border-border bg-background py-3 text-xs font-bold uppercase tracking-widest text-foreground transition-all hover:bg-secondary active:scale-[0.98]"
          >
            {tx("Wróć do strony głównej", "Back to the home page")}
          </Link>
        </div>
      </div>
    </main>
  );
}
