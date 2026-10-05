"use client";

import { useOptionalTx } from "@/lib/i18n/language-context";

export default function Loading() {
  const tx = useOptionalTx();
  return (
    <div
      className="min-h-[100dvh] bg-[var(--chan-nav,#f7f9fc)]"
      aria-label={tx("Przechodzę do strony", "Loading the page")}
      role="status"
    />
  );
}
