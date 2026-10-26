"use client";
// patron zone (docs/architecture/patron-zone.md): the calm reassurance line at the very bottom of the checkout. It never
// names a payment provider (there may be several). In demo mode it must not claim real processing: it says nothing is charged.
import React from "react";
import { Lock } from "lucide-react";
import type { Tx } from "@/lib/i18n/ui";
import styles from "./premium-pass.module.css";

export function PassSecurityFooter({ tx, demo }: { tx: Tx; demo: boolean }) {
  return (
    <p className={styles.secureFooter} data-secure-footer="">
      <Lock size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
      <span>
        {demo
          ? tx("Tryb demonstracyjny: nic nie zostanie pobrane.", "Demo mode: nothing will be charged.")
          : tx("Płatność jest szyfrowana i obsługuje ją zaufany operator płatności. Nie przechowujemy danych karty.", "Payments are encrypted and handled by a trusted provider. We never store your card details.")}
      </span>
    </p>
  );
}
