"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): step 1 of the checkout. The amount (a suggested one or
// the viewer's own), the payment method (the tip gateway's dropdown) and the Terms / Privacy Policy as plain LINKS:
// nothing to tick here, the consent is given in step 2 next to the payment itself.
import React, { useId, useState } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { txRich } from "@/lib/i18n/rich";
import type { Tx } from "@/lib/i18n/ui";
import type { PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { describeTipMethod } from "../support/tip-flow-config";
import { TipSelect } from "../support/TipSelect";
import { currencySymbol, parseAmountInput, price, vatLine } from "./pass-copy";
import styles from "./premium-pass.module.css";

/** The chosen amount: what the viewer typed (pay what you want), prefilled with the minimum. */
export function usePassAmount(offer: PremiumPassOffer) {
  const [custom, setCustom] = useState(String(offer.defaultMinor / 100));
  const minor = parseAmountInput(custom);
  const problem: "empty" | "invalid" | "low" | "high" | null =
    minor === null ? (custom.trim() === "" ? "empty" : "invalid") : minor < offer.minMinor ? "low" : minor > offer.maxMinor ? "high" : null;
  return {
    minor: problem === null ? minor : null,
    custom,
    problem,
    typeCustom: setCustom,
  };
}

export type PassAmount = ReturnType<typeof usePassAmount>;

export interface PassAmountStepProps {
  tx: Tx;
  language: Locale;
  offer: PremiumPassOffer;
  amount: PassAmount;
  methods: string[];
  method: string | null;
  onMethod: (method: string) => void;
  /** An access period is still running: the next payment extends it. */
  activeUntil?: string;
  notice?: string | null;
  unavailable: boolean;
  busy: boolean;
  tried: boolean;
  formatDate: (iso: string) => string;
}

export function PassAmountStep({ tx, language, offer, amount, methods, method, onMethod, activeUntil, notice, unavailable, busy, tried, formatDate }: PassAmountStepProps) {
  const ids = useId();
  const total = amount.minor === null ? null : price(language, amount.minor);
  const showProblem = amount.problem !== null && (tried || amount.problem === "low" || amount.problem === "high" || amount.problem === "invalid");
  const problemText =
    amount.problem === "low"
      ? tx("Kwota jest za niska. Minimum: {0}.", "Amount too low. Minimum: {0}.", price(language, offer.minMinor))
      : amount.problem === "high"
        ? tx("Kwota jest za wysoka. Maksimum: {0}.", "Amount too high. Maximum: {0}.", price(language, offer.maxMinor))
        : amount.problem === "invalid"
          ? tx("Wpisz kwotę cyframi, np. 15 lub 15,50.", "Enter the amount in digits, e.g. 15 or 15.50.")
          : tx("Wpisz kwotę (co najmniej {0}).", "Enter an amount (at least {0}).", price(language, offer.minMinor));

  return (
    <>
      {activeUntil && (
        <p className={styles.notice} role="status">
          {tx("Masz dostęp do {0}. Kolejna wpłata przedłuży go o {1} dni.", "You have access until {0}. Another payment extends it by {1} days.", formatDate(activeUntil), offer.accessDays)}
        </p>
      )}
      {unavailable && (
        <p className={styles.noticeWarn} role="alert">
          {tx("Płatności są chwilowo niedostępne. Spróbuj ponownie później.", "Payments are temporarily unavailable. Please try again later.")}
        </p>
      )}

      <div className={styles.amountHead}>
        <p className={styles.amountLead}>{tx("Zapłać ile chcesz. Minimum {0}.", "Pay what you want. Minimum {0}.", price(language, offer.minMinor))}</p>
      </div>

      <div className={styles.fieldBlock}>
        <label htmlFor={`${ids}-custom`} className={styles.label}>{tx("Twoja kwota", "Your amount")}</label>
        <div className={styles.field}>
          <input
            id={`${ids}-custom`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            disabled={busy}
            value={amount.custom}
            placeholder={String(offer.minMinor / 100)}
            onChange={(event) => amount.typeCustom(event.target.value)}
            aria-invalid={showProblem ? true : undefined}
            aria-describedby={`${ids}-help`}
          />
          <span aria-hidden="true">{currencySymbol(language)}</span>
        </div>
        <p id={`${ids}-help`} className={showProblem ? styles.error : styles.muted} role={showProblem ? "alert" : undefined} style={{ margin: "6px 0 0" }}>
          {showProblem
            ? problemText
            : tx("Od {0} do {1}. Każda wpłata daje dostęp na {2} dni.", "From {0} to {1}. Every payment gives access for {2} days.", price(language, offer.minMinor), price(language, offer.maxMinor), offer.accessDays)}
        </p>
      </div>

      <TipSelect
        label={tx("Metoda płatności", "Payment method")}
        value={method}
        onChange={onMethod}
        options={methods.map((value) => ({ value, ...describeTipMethod(value, tx) }))}
      />
      {notice && <p className={styles.noticeWarn} role="alert">{notice}</p>}

      <div className={styles.order}>
        <div className={styles.orderLine}>
          <div>
            <b>{tx("Dostęp do strefy patrona", "Patron zone access")}</b>
            <div className={styles.muted}>{tx("na {0} dni, nie odnawia się", "for {0} days, does not renew", offer.accessDays)}</div>
          </div>
          <b>{total ?? "—"}</b>
        </div>
        <div className={styles.orderTotal}>
          <span>{tx("Razem do zapłaty (brutto)", "Total to pay (incl. VAT)")}</span>
          <b>{total ?? "—"}</b>
        </div>
      </div>
      <p className={styles.muted} style={{ margin: "-6px 0 0" }}>{vatLine(tx, offer.vatRatePercent)}</p>

      <p className={styles.legalLinks}>
        {txRich(
          tx,
          "Przed zapłatą zapoznaj się z dokumentami: {0} i {1}. Zgodę potwierdzisz w następnym kroku.",
          "Before you pay, read the documents: {0} and {1}. You confirm your consent in the next step.",
          <a href={getLocalizedHref(language, "passTerms")} target="_blank" rel="noopener">{tx("Regulamin strefy patrona", "Patron Zone Terms")}</a>,
          <a href={getLocalizedHref(language, "privacy")} target="_blank" rel="noopener">{tx("Polityka prywatności", "Privacy Policy")}</a>,
        )}
      </p>
    </>
  );
}
