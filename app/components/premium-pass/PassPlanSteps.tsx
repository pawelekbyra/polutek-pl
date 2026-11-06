"use client";
// patron zone (docs/architecture/patron-zone.md): the first two of the three checkout steps and the order
// summary that stays visible in all three. Step 1: the currency (the tip gateway's own currency list) and
// the choice of two fixed options, prices in that currency. Step 2: the payment method (the tip gateway's dropdown)
// and the Terms / Privacy Policy as plain LINKS: nothing to tick before step 3. The browser only names a product and a
// currency; the server owns the price table.
import React, { useId } from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";
import { getLocalizedHref } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import type { PatronCurrency } from "@/lib/modules/patron-zone/domain/config";
import type { PatronOfferProduct, PremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import { TIP_CURRENCY_SYMBOLS, describeTipMethod, tipCurrencyTitle } from "../support/tip-flow-config";
import { TipSelect } from "../support/TipSelect";
import { PassSellerCard } from "./PassSellerCard";
import { PassTrustRow, type PassPayMode } from "./PassTrustRow";
import { price, productName, productNote, totalLabel, vatLine, vatTermsNote } from "./pass-copy";
import styles from "./premium-pass.module.css";

/**
 * The order summary, in every step. Step 1 (`totalOnly`): ONE row, "Razem do zapłaty" + price + the VAT note (the chosen card
 * is already visible above, so it is not repeated). Step 2: name, note, total and VAT line. Step 3 (`compact`): one row with the
 * option name and the price, and under it the VAT note (`vatTermsNote`).
 */
export function PassOrderSummary({ tx, language, offer, product, currency, compact, totalOnly }: { tx: Tx; language: Locale; offer: PremiumPassOffer; product: PatronOfferProduct; currency: PatronCurrency; compact?: boolean; totalOnly?: boolean }) {
  const total = price(language, product.prices[currency], currency);
  if (compact) {
    return (
      <div className={styles.summaryRow} role="group" aria-label={tx("Podsumowanie zamówienia", "Order summary")}>
        <span>{productName(tx, product.id)}</span>
        <b>{total}</b>
        {/* DO UZGODNIENIA z właścicielem/księgowym: ta sama nota VAT co w regulaminie (vatTermsNote), zależna od VAT_STATUS; treści nie zmieniamy. */}
        <small>{vatTermsNote(tx)}</small>
      </div>
    );
  }
  return (
    <div role="group" aria-label={tx("Podsumowanie zamówienia", "Order summary")}>
      {totalOnly ? (
        <div className={cn(styles.order, styles.orderSolo)}>
          <div className={styles.orderSoloRow}>
            <div>
              <span className={styles.orderSoloLabel}>{totalLabel(tx)}</span>
              <span className={styles.orderSoloNote}>{productNote(tx, product)}</span>
            </div>
            <div>
              <b className={styles.orderSoloPrice}>{total}</b>
              <small className={styles.orderSoloVat}>{vatLine(tx)}</small>
            </div>
          </div>
        </div>
      ) : (
      <div className={styles.order}>
        {!totalOnly && (
          <div className={styles.orderLine}>
            <div>
              <b>{productName(tx, product.id)}</b>
              <div className={styles.muted}>{productNote(tx, product)}, {tx("nie odnawia się", "does not renew")}</div>
            </div>
            <b>{total}</b>
          </div>
        )}
        <div className={styles.orderTotal}>
          <span>{totalLabel(tx)}</span>
          <b>{total}</b>
          <small>{vatLine(tx)}</small>
        </div>
      </div>
      )}
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
  /** Gateway mode and the method ids on offer for this currency: what the trust row (SSL line, logos) may claim. */
  mode: PassPayMode;
  methods: string[];
}

export interface PassPlanStepProps extends CommonProps {
  onProduct: (id: string) => void;
  onCurrency: (currency: PatronCurrency) => void;
}

/** Step 1: currency and option, with the order summary. */
export function PassPlanStep({ tx, language, offer, product, currency, onProduct, onCurrency, notice, unavailable, busy, mode, methods }: PassPlanStepProps) {
  const ids = useId();
  return (
    <>
      {unavailable && (
        <p className={styles.noticeWarn} role="alert">
          {tx("Płatności są chwilowo niedostępne. Spróbuj ponownie później.", "Payments are temporarily unavailable. Please try again later.")}
        </p>
      )}
      <fieldset className={styles.products} disabled={busy}>
        {/* No visible "Wybierz dostęp" row (it merged with the currency label): the group keeps its name for screen readers via this legend. */}
        <legend className="sr-only">{tx("Wybierz dostęp", "Choose your access")}</legend>
        {/* The currency is a small pill on its own slim row (the purchase cards below are the main thing). The visible label is aria-hidden: the pill's own (screen-reader) label is the same text. */}
        <div className={styles.currencyRow}>
          <span className={styles.currencyLabel} aria-hidden="true">{tx("Waluta płatności", "Payment currency")}</span>
          <TipSelect
            compact
            label={tx("Waluta płatności", "Payment currency")}
            value={currency}
            onChange={(code) => onCurrency(code as PatronCurrency)}
            disabled={busy}
            options={offer.currencies.map((code) => ({ value: code, icon: TIP_CURRENCY_SYMBOLS[code], title: tipCurrencyTitle(tx, code), short: `${TIP_CURRENCY_SYMBOLS[code]} · ${code}` }))}
          />
        </div>
        <div className={styles.productGrid}>
          {offer.products.map((p) => (
            <label key={p.id} className={styles.product}>
              <input type="radio" name={`${ids}-product`} value={p.id} checked={p.id === product.id} onChange={() => onProduct(p.id)} />
              <span className={styles.productCheck} aria-hidden="true" />
              {p.bestValue && <span className={styles.bestValue}>{tx("Bestseller", "Bestseller")}</span>}
              <span className={styles.productName}>{productName(tx, p.id)}</span>
              <span className={styles.productFoot}>
                <span className={styles.productPrice}>{price(language, p.prices[currency], currency)}</span>
                <span className={styles.productNote}>{productNote(tx, p)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {notice && <p className={styles.noticeWarn} role="alert">{notice}</p>}

      {/* Seller first (a passive info row), the total last, right above the action button. */}
      <PassSellerCard tx={tx} mode={mode} />
      <PassOrderSummary tx={tx} language={language} offer={offer} product={product} currency={currency} totalOnly />
      <PassTrustRow tx={tx} mode={mode} methods={methods} currency={currency} />
    </>
  );
}

/** Step 3 head (both modes): the seller row first, then the label-style heading with the order summary under it (8 px, like any field). */
export function PassPayHead({ heading, tx, mode, methods, ...summary }: { heading: React.ReactNode; tx: Tx; language: Locale; offer: PremiumPassOffer; product: PatronOfferProduct; currency: PatronCurrency; mode: PassPayMode; methods: string[] }) {
  return (
    <>
      <PassSellerCard tx={tx} compact mode={mode} />
      <div>
        {heading}
        <PassOrderSummary tx={tx} {...summary} compact />
        <PassTrustRow tx={tx} mode={mode} methods={methods} currency={summary.currency} />
      </div>
    </>
  );
}

export interface PassMethodStepProps extends CommonProps {
  method: string | null;
  onMethod: (method: string) => void;
}

/** Step 2: the payment method and the order summary, Terms and Privacy Policy as links. */
export function PassMethodStep({ tx, language, offer, product, currency, methods, method, onMethod, notice, unavailable, mode }: PassMethodStepProps) {
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

      <PassSellerCard tx={tx} mode={mode} />
      <PassOrderSummary tx={tx} language={language} offer={offer} product={product} currency={currency} />
      <PassTrustRow tx={tx} mode={mode} methods={methods} currency={currency} />
    </>
  );
}
