"use client";
// patron zone (docs/architecture/patron-zone.md): the calm line at the very bottom of the checkout. Steps 1 and 2 show the
// two documents there (Terms and Privacy Policy, plain links; the consent itself is ticked in step 3); step 3 shows the
// reassurance line, which never names a payment provider (there may be several). In demo mode that line must not claim
// real processing: it says nothing is charged.
import React from "react";
import { Lock } from "lucide-react";
import type { Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { LegalLink } from "../legal/legal-sheet-context";
import styles from "./premium-pass.module.css";

/**
 * The three step dots, centred at the bottom, just above the action bar's top line, as a stepper. The dots of the steps
 * already passed are buttons (back only, never forward: the later steps need the earlier answers); the current one and the
 * ones ahead are plain markers. The dots stay 8 px; each button has a 44 px touch area (a pseudo-element, see .stepBtn) and the
 * dots are 44 px apart centre to centre, so the areas never overlap. `disabled` (a payment is being created or confirmed)
 * turns the buttons off. The step itself is announced by the checkout ("Krok N z 3") and the heading takes focus.
 */
export function PassStepDots({ tx, step, onStep, disabled = false }: { tx: Tx; step: number; onStep?: (step: number) => void; disabled?: boolean }) {
  const pips = [tx("Dostęp", "Access"), tx("Metoda", "Method"), tx("Płatność", "Payment")];
  return (
    <ol className={styles.stepDots} aria-label={tx("Etapy zakupu", "Checkout steps")}>
      {pips.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        return (
          <li key={label} aria-current={step === n ? "step" : undefined} className={cn(styles.stepItem, done && styles.stepItemDone)}>
            {done && onStep ? (
              <button
                type="button"
                className={cn(styles.stepPip, styles.stepBtn)}
                disabled={disabled}
                aria-label={tx("Wróć do kroku {0}: {1}", "Back to step {0}: {1}", n, label)}
                onClick={() => onStep(n)}
              />
            ) : (
              <>
                <span className={cn(styles.stepPip, step === n && styles.stepPipNow)} aria-hidden="true" />
                <span className={styles.srOnly}>{label}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function PassSecurityFooter({ tx, demo, language, links = false }: { tx: Tx; demo: boolean; language: Locale; links?: boolean }) {
  return <PassFooterLine tx={tx} demo={demo} language={language} links={links} />;
}

function PassFooterLine({ tx, demo, language, links }: { tx: Tx; demo: boolean; language: Locale; links: boolean }) {
  if (links) {
    return (
      <p className={styles.secureFooter} data-secure-footer="" data-legal-footer="">
        <span className={styles.legalRow}>
          <LegalLink doc="terms" language={language}>{tx("Regulamin", "Terms")}</LegalLink>
          <span className={styles.legalSep} aria-hidden="true" />
          <LegalLink doc="privacy" language={language}>{tx("Polityka prywatności", "Privacy Policy")}</LegalLink>
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
