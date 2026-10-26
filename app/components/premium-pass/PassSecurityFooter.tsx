"use client";
// patron zone (docs/architecture/patron-zone.md): the calm line at the very bottom of the checkout. Steps 1 and 2 show the
// two documents there (Terms and Privacy Policy, plain links; the consent itself is ticked in step 3); step 3 shows the
// reassurance line, which never names a payment provider (there may be several). In demo mode that line must not claim
// real processing: it says nothing is charged.
import React from "react";
import { Lock } from "lucide-react";
import type { Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { getLocalizedHref } from "@/lib/i18n/routing";
import styles from "./premium-pass.module.css";

export function PassSecurityFooter({ tx, demo, language, links = false }: { tx: Tx; demo: boolean; language: Locale; links?: boolean }) {
  if (links) {
    return (
      <p className={styles.secureFooter} data-secure-footer="" data-legal-footer="">
        <span className={styles.legalRow}>
          <a href={getLocalizedHref(language, "passTerms")} target="_blank" rel="noopener">{tx("Regulamin", "Terms")}</a>
          {" "}{tx("i", "and")}{" "}
          <a href={getLocalizedHref(language, "privacy")} target="_blank" rel="noopener">{tx("Polityka prywatności", "Privacy Policy")}</a>
        </span>
      </p>
    );
  }
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
