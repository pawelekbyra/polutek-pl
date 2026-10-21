"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): step 1 of the checkout. A choice of TWO FIXED OPTIONS
// (radio cards: name, big price, short note, a "best value" label on the better one), the payment method (the tip
// gateway's dropdown) and the Terms / Privacy Policy as plain LINKS: nothing to tick here, the consent is given in
// step 2 next to the payment itself. The browser only names a product; the server owns the prices.
import React, { useId } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { txRich } from "@/lib/i18n/rich";
import type { Tx } from "@/lib/i18n/ui";
import type { PatronOfferProduct, PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { describeTipMethod } from "../support/tip-flow-config";
import { TipSelect } from "../support/TipSelect";
import { price, productName, productNote, vatLine } from "./pass-copy";
import styles from "./premium-pass.module.css";

export interface PassOptionStepProps {
  tx: Tx;
  language: Locale;
  offer: PremiumPassOffer;
  product: PatronOfferProduct;
  onProduct: (id: string) => void;
  methods: string[];
  method: string | null;
  onMethod: (method: string) => void;
  /** The viewer's own running access: unlimited blocks a new purchase, a 30-day one is extended or converted. */
  access: { lifetime: boolean; expiresAt: string | null } | null;
  notice?: string | null;
  unavailable: boolean;
  busy: boolean;
  formatDate: (iso: string) => string;
}

export function PassOptionStep({ tx, language, offer, product, onProduct, methods, method, onMethod, access, notice, unavailable, busy, formatDate }: PassOptionStepProps) {
  const ids = useId();
  const total = price(language, product.priceMinor);
  return (
    <>
      {access?.lifetime && <p className={styles.notice} role="status">{tx("Masz już dostęp bez limitu.", "You already have unlimited access.")}</p>}
      {access && !access.lifetime && access.expiresAt && (
        <p className={styles.notice} role="status">
          {tx("Masz dostęp do {0}. 30 dni przedłuża go, dostęp bez limitu zamienia go na stały.", "You have access until {0}. 30 days extends it, unlimited access makes it permanent.", formatDate(access.expiresAt))}
        </p>
      )}
      {unavailable && (
        <p className={styles.noticeWarn} role="alert">
          {tx("Płatności są chwilowo niedostępne. Spróbuj ponownie później.", "Payments are temporarily unavailable. Please try again later.")}
        </p>
      )}

      <fieldset className={styles.products} disabled={busy || access?.lifetime === true}>
        <legend className={styles.amountLead}>{tx("Wybierz dostęp", "Choose your access")}</legend>
        {offer.products.map((p) => (
          <label key={p.id} className={styles.product}>
            <input type="radio" name={`${ids}-product`} value={p.id} checked={p.id === product.id} onChange={() => onProduct(p.id)} />
            {p.bestValue && <span className={styles.bestValue}>{tx("Najlepsza wartość", "Best value")}</span>}
            <span className={styles.productName}>{productName(tx, p.id)}</span>
            <span className={styles.productPrice}>{price(language, p.priceMinor)}</span>
            <span className={styles.productNote}>{productNote(tx, p)}</span>
          </label>
        ))}
      </fieldset>

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
            <b>{productName(tx, product.id)}</b>
            <div className={styles.muted}>{productNote(tx, product)}, {tx("nie odnawia się", "does not renew")}</div>
          </div>
          <b>{total}</b>
        </div>
        <div className={styles.orderTotal}>
          <span>{tx("Razem do zapłaty (brutto)", "Total to pay (incl. VAT)")}</span>
          <b>{total}</b>
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
