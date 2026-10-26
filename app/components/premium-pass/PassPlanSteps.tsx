"use client";
// patron zone (docs/architecture/patron-zone.md): the first two of the three checkout steps and the order
// summary that stays visible in all three. Step 1: the currency (the tip gateway's own currency picker and list) and
// the choice of two fixed options, prices in that currency. Step 2: the payment method (the tip gateway's dropdown)
// and the Terms / Privacy Policy as plain LINKS: nothing to tick before step 3. The browser only names a product and a
// currency; the server owns the price table.
import React, { useId } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { getLocalizedHref } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import type { PatronCurrency } from "@/lib/modules/patron-zone/domain/config";
import type { PatronOfferProduct, PremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import { TIP_CURRENCY_SYMBOLS, describeTipMethod, tipCurrencyTitle } from "../support/tip-flow-config";
import { TipSelect } from "../support/TipSelect";
import { PassSellerCard } from "./PassSellerCard";
import { price, productName, productNote, vatLine } from "./pass-copy";
import styles from "./premium-pass.module.css";

/** The order summary (name, note, total, VAT line), shown in every step; `compact` is one line for the payment step. */
export function PassOrderSummary({ tx, language, offer, product, currency, compact }: { tx: Tx; language: Locale; offer: PremiumPassOffer; product: PatronOfferProduct; currency: PatronCurrency; compact?: boolean }) {
  const total = price(language, product.prices[currency], currency);
  if (compact) {
    return (
      <div className={styles.summaryRow} role="group" aria-label={tx("Podsumowanie zamówienia", "Order summary")}>
        <span>{productName(tx, product.id)}</span>
        <b>{total}</b>
      </div>
    );
  }
  return (
    <div role="group" aria-label={tx("Podsumowanie zamówienia", "Order summary")}>
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
      <p className={styles.muted} style={{ margin: "6px 0 0" }}>{vatLine(tx, offer.vatRatePercent)}</p>
    </div>
  );
}

interface CommonProps {
  tx: Tx;
  language: Locale;
  offer: PremiumPassOffer;
  product: PatronOfferProduct;
  currency: PatronCurrency;
  notice?: string | null;
  unavailable: boolean;
  busy: boolean;
}

export interface PassPlanStepProps extends CommonProps {
  onProduct: (id: string) => void;
  onCurrency: (currency: PatronCurrency) => void;
  /** The viewer's own running access: unlimited blocks a new purchase, a 30-day one is extended or converted. */
  access: { lifetime: boolean; expiresAt: string | null } | null;
}

/** Step 1: currency and option, with the order summary. */
export function PassPlanStep({ tx, language, offer, product, currency, onProduct, onCurrency, access, notice, unavailable, busy }: PassPlanStepProps) {
  const ids = useId();
  return (
    <>
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
            {p.bestValue && <span className={styles.bestValue}>{tx("Bestseller", "Bestseller")}</span>}
            <span className={styles.productName}>{productName(tx, p.id)}</span>
            <span className={styles.productPrice}>{price(language, p.prices[currency], currency)}</span>
            <span className={styles.productNote}>{productNote(tx, p)}</span>
          </label>
        ))}
      </fieldset>

      <TipSelect
        label={tx("Waluta", "Currency")}
        value={currency}
        onChange={(code) => onCurrency(code as PatronCurrency)}
        disabled={busy || access?.lifetime === true}
        options={offer.currencies.map((code) => ({ value: code, icon: TIP_CURRENCY_SYMBOLS[code], title: tipCurrencyTitle(tx, code) }))}
      />
      {notice && <p className={styles.noticeWarn} role="alert">{notice}</p>}

      <PassOrderSummary tx={tx} language={language} offer={offer} product={product} currency={currency} />
      <PassSellerCard tx={tx} />
      <PassLegalLinks tx={tx} language={language} />
    </>
  );
}

export interface PassMethodStepProps extends CommonProps {
  methods: string[];
  method: string | null;
  onMethod: (method: string) => void;
}

/** Step 2: the payment method and the order summary, Terms and Privacy Policy as links. */
export function PassMethodStep({ tx, language, offer, product, currency, methods, method, onMethod, notice, unavailable }: PassMethodStepProps) {
  return (
    <>
      {unavailable && (
        <p className={styles.noticeWarn} role="alert">
          {tx("Płatności są chwilowo niedostępne. Spróbuj ponownie później.", "Payments are temporarily unavailable. Please try again later.")}
        </p>
      )}
      <TipSelect
        label={tx("Metoda płatności", "Payment method")}
        value={method}
        onChange={onMethod}
        options={methods.map((value) => ({ value, ...describeTipMethod(value, tx) }))}
      />
      {notice && <p className={styles.noticeWarn} role="alert">{notice}</p>}

      <PassOrderSummary tx={tx} language={language} offer={offer} product={product} currency={currency} />

      <PassSellerCard tx={tx} />
      <PassLegalLinks tx={tx} language={language} />
    </>
  );
}

/** Terms and Privacy Policy as small links at the bottom of steps 1 and 2 (the consent itself is ticked in step 3). */
export function PassLegalLinks({ tx, language }: { tx: Tx; language: Locale }) {
  return (
    <p className={styles.legalLinks}>
      {tx("Przed zapłatą zapoznaj się z dokumentami:", "Before you pay, read the documents:")}
      <span className={styles.legalRow}>
        <a href={getLocalizedHref(language, "passTerms")} target="_blank" rel="noopener">{tx("Regulamin", "Terms")}</a>
        {" "}{tx("i", "and")}{" "}
        <a href={getLocalizedHref(language, "privacy")} target="_blank" rel="noopener">{tx("Polityka prywatności", "Privacy Policy")}</a>
      </span>
    </p>
  );
}
