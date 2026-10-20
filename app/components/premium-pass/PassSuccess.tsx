"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.4): success with the receipt (the art. 21
// u.p.k. confirmation, shown on screen in the demo), the declined and the "already active" states.
import React from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import type { PassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";
import { CheckIcon, CrossIcon, PlayIcon } from "./PassIcons";
import { methodLabel, passDate, passName, price, sellerName } from "./pass-copy";
import styles from "./premium-pass.module.css";

export function PassReceipt({ tx, language, pass }: { tx: Tx; language: Locale; pass: Exclude<PassStatusDto, { state: "none" }> }) {
  return (
    <dl className={styles.receipt}>
      <div><dt>{tx("Nr zamówienia", "Order no.")}</dt><dd className={styles.mono}>{pass.ref}</dd></div>
      <div><dt>{tx("Produkt", "Product")}</dt><dd>{passName(tx, pass.product)}</dd></div>
      <div><dt>{tx("Kwota", "Amount")}</dt><dd>{price(language, pass.priceMinor)} <span className={styles.muted}>{tx("(demo: 0 zł)", "(demo: PLN 0)")}</span></dd></div>
      <div><dt>{tx("Metoda", "Method")}</dt><dd>{methodLabel(tx, pass.method)} {tx("(symulacja)", "(simulated)")}</dd></div>
      <div><dt>{tx("Ważna do", "Valid until")}</dt><dd>{passDate(language, pass.expiresAt, true)}</dd></div>
      <div><dt>{tx("Zgoda na dostęp od razu", "Consent to immediate access")}</dt><dd>{passDate(language, pass.waiverAt, true)}</dd></div>
      <div><dt>{tx("Sprzedawca", "Seller")}</dt><dd>{sellerName(tx)}</dd></div>
    </dl>
  );
}

export function PassSuccess({ tx, language, pass, onWatch, watchLabel }: { tx: Tx; language: Locale; pass: Exclude<PassStatusDto, { state: "none" }>; onWatch: () => void; watchLabel?: string }) {
  return (
    <div className={styles.result} aria-live="polite">
      <div className={cn(styles.check, styles.checkAnim)}><CheckIcon animated /></div>
      <h3 className={styles.resultTitle}>{tx("Wejściówka aktywna", "Your pass is active")}</h3>
      <p className={styles.resultText}>{tx("Masz dostęp do {0}", "You have access until {0}", passDate(language, pass.expiresAt, true))}</p>
      <button type="button" className={cn(styles.goldBtn, styles.wide)} onClick={onWatch} data-autofocus="">
        <PlayIcon />
        {watchLabel ?? tx("Oglądaj teraz", "Watch now")}
      </button>
      <PassReceipt tx={tx} language={language} pass={pass} />
      <p className={styles.fine}>
        {tx(
          "W prawdziwej sprzedaży to potwierdzenie przyszłoby e-mailem (trwały nośnik). Znajdziesz je też w „Moje konto → Wejściówka”.",
          "In a real sale this confirmation would arrive by e-mail (durable medium). You can also find it in “My account → Pass”.",
        )}
      </p>
    </div>
  );
}

export function PassDeclined({ tx, onRetry, onChangeMethod }: { tx: Tx; onRetry: () => void; onChangeMethod: () => void }) {
  return (
    <div className={styles.result} aria-live="polite">
      <div className={cn(styles.check, styles.declined)}><CrossIcon /></div>
      <h3 className={styles.resultTitle}>{tx("Płatność nie przeszła", "The payment did not go through")}</h3>
      <p className={styles.resultText}>{tx("Płatność nie przeszła. Nic nie zostało pobrane.", "The payment did not go through. Nothing was charged.")}</p>
      <div className={styles.row}>
        <button type="button" className={styles.lineBtn} onClick={onChangeMethod}>{tx("Zmień metodę", "Change method")}</button>
        <button type="button" className={styles.inkBtn} style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={onRetry} data-autofocus="">
          {tx("Spróbuj ponownie", "Try again")}
        </button>
      </div>
    </div>
  );
}

export function PassAlreadyActive({ tx, language, expiresAt, onWatch }: { tx: Tx; language: Locale; expiresAt?: string; onWatch: () => void }) {
  return (
    <div className={styles.result} aria-live="polite">
      <div className={styles.check}><CheckIcon /></div>
      <h3 className={styles.resultTitle}>{tx("Masz już wejściówkę", "You already have a pass")}</h3>
      {expiresAt && <p className={styles.resultText}>{tx("Masz już wejściówkę ważną do {0}.", "You already have a pass valid until {0}.", passDate(language, expiresAt, true))}</p>}
      <button type="button" className={cn(styles.goldBtn, styles.wide)} onClick={onWatch} data-autofocus="">
        <PlayIcon />
        {tx("Oglądaj teraz", "Watch now")}
      </button>
    </div>
  );
}
