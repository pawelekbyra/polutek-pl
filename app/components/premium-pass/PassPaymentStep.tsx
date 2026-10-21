"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): step 2 of the checkout. The payment of the chosen
// method, drawn by the tip gateway's own forms (BLIK, Przelewy24, card, wallets, Stripe's Payment Element), and THE
// place where the viewer accepts the Terms and the Privacy Policy. In demo mode the same screen has no payment form:
// the payment is simulated by the server.
import React, { useMemo } from "react";
import { Elements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { cn } from "@/lib/utils";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { txRich } from "@/lib/i18n/rich";
import { stripeLocale, type Tx } from "@/lib/i18n/ui";
import { describeTipMethod } from "../support/tip-flow-config";
import { TipPayStep } from "../support/TipPayStep";
import type { TipConfirmOutcome } from "../support/tip-confirm";
import { price } from "./pass-copy";
import styles from "./premium-pass.module.css";

export type PassConsentState = { terms: boolean; waiver: boolean };
export type PassConsentErrors = { terms?: boolean; waiver?: boolean };

/** The two boxes of step 2: Terms + Privacy Policy, and immediate access (loss of the right of withdrawal). */
export function PassConsent({
  tx,
  language,
  ids,
  value,
  errors,
  onChange,
  termsRef,
  waiverRef,
}: {
  tx: Tx;
  language: Locale;
  ids: string;
  value: PassConsentState;
  errors: PassConsentErrors;
  onChange: (next: PassConsentState) => void;
  termsRef?: React.Ref<HTMLInputElement>;
  waiverRef?: React.Ref<HTMLInputElement>;
}) {
  const consentError = tx("Zaznacz to pole, aby kontynuować.", "Tick this box to continue.");
  return (
    <div className={styles.consents}>
      <div className={cn(styles.consent, errors.terms && styles.consentError)}>
        <input ref={termsRef} id={`${ids}-terms`} type="checkbox" checked={value.terms} onChange={(e) => onChange({ ...value, terms: e.target.checked })} aria-invalid={errors.terms || undefined} aria-describedby={errors.terms ? `${ids}-terms-error` : undefined} />
        <label htmlFor={`${ids}-terms`}>
          {txRich(
            tx,
            "Akceptuję {0} i {1}.",
            "I accept the {0} and the {1}.",
            <a href={getLocalizedHref(language, "passTerms")} target="_blank" rel="noopener">{tx("Regulamin strefy patrona", "Patron Zone Terms")}</a>,
            <a href={getLocalizedHref(language, "privacy")} target="_blank" rel="noopener">{tx("Politykę prywatności", "Privacy Policy")}</a>,
          )}
        </label>
        {errors.terms && <p id={`${ids}-terms-error`} className={styles.error}>{consentError}</p>}
      </div>
      <div className={cn(styles.consent, errors.waiver && styles.consentError)}>
        <input ref={waiverRef} id={`${ids}-waiver`} type="checkbox" checked={value.waiver} onChange={(e) => onChange({ ...value, waiver: e.target.checked })} aria-invalid={errors.waiver || undefined} aria-describedby={errors.waiver ? `${ids}-waiver-error` : undefined} />
        <label htmlFor={`${ids}-waiver`}>
          {tx("Chcę dostępu od razu. Wiem, że gdy zacznę oglądać, tracę prawo odstąpienia od umowy.", "I want access right away. I understand that once I start watching, I lose my right to withdraw.")}
        </label>
        {errors.waiver && <p id={`${ids}-waiver-error`} className={styles.error}>{consentError}</p>}
      </div>
      {!(value.terms && value.waiver) && (
        <p className={styles.muted} style={{ margin: 0 }}>{tx("Zaznacz obie zgody, aby zapłacić.", "Tick both boxes to pay.")}</p>
      )}
    </div>
  );
}

/** Demo mode: a summary strip like the tip gateway's, in place of a payment form. */
export function PassDemoSummary({ tx, language, amountMinor, method, onChangeMethod }: { tx: Tx; language: Locale; amountMinor: number; method: string; onChangeMethod: () => void }) {
  return (
    <div className={styles.strip}>
      <p>
        <b>{price(language, amountMinor)}</b> · {describeTipMethod(method, tx).title}
      </p>
      <button type="button" className={styles.ghostBtn} onClick={onChangeMethod}>{tx("Zmień", "Change")}</button>
    </div>
  );
}

const APPEARANCE: StripeElementsOptions["appearance"] = {
  theme: "flat",
  variables: { colorPrimary: "#2563eb", colorBackground: "#ffffff", colorText: "#1a1a1a", borderRadius: "12px", fontFamily: "var(--font-geist-sans)" },
};

export interface PassStripePayProps {
  language: Locale;
  amountMinor: number;
  method: string;
  clientSecret: string;
  paymentId: string;
  userEmail?: string;
  stripePromise: Promise<Stripe | null> | null;
  returnUrl: string;
  consent: React.ReactNode;
  accepted: boolean;
  beforeConfirm: () => Promise<boolean>;
  onChangeMethod: () => void;
  onConfirmed: (outcome: TipConfirmOutcome) => void;
}

/** One Elements group per intent; the per-method form confirms against its client secret (the tip gateway's flow). */
export function PassStripePay(props: PassStripePayProps) {
  const options = useMemo<StripeElementsOptions>(
    () => ({ clientSecret: props.clientSecret, locale: stripeLocale(props.language), appearance: APPEARANCE }),
    [props.clientSecret, props.language],
  );
  return (
    <div className={styles.payHost}>
      <Elements key={`${props.clientSecret}:${props.amountMinor}`} stripe={props.stripePromise} options={options}>
        <TipPayStep
          language={props.language}
          amount={props.amountMinor / 100}
          currency="PLN"
          method={props.method}
          clientSecret={props.clientSecret}
          paymentId={props.paymentId}
          userEmail={props.userEmail}
          stripePromise={props.stripePromise}
          onChangeMethod={props.onChangeMethod}
          onConfirmed={props.onConfirmed}
          patron={{ returnUrl: props.returnUrl, consent: props.consent, accepted: props.accepted, beforeConfirm: props.beforeConfirm }}
        />
      </Elements>
    </div>
  );
}
