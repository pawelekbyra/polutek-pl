"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): the end states of the checkout: success with the receipt
// (the art. 21 u.p.k. confirmation, shown on screen), a payment still being confirmed, and a payment that did not go
// through. All announce themselves politely (aria-live) and take focus through their heading.
import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import type { PassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";
import { CheckIcon, CrossIcon, PlayIcon } from "./PassIcons";
import { methodLabel, passDate, price, productName, sellerName } from "./pass-copy";
import styles from "./premium-pass.module.css";

type ActivePass = Exclude<PassStatusDto, { state: "none" }>;

/** `DEMO-XXXX-XXXX` as is; a payment id is long, so the receipt shows its first block. */
function shortRef(ref: string): string {
  return ref.startsWith("DEMO-") ? ref : ref.slice(0, 8).toUpperCase();
}

export function PassReceipt({ tx, language, pass }: { tx: Tx; language: Locale; pass: ActivePass }) {
  const demo = pass.provider === "DEMO";
  return (
    <dl className={styles.receipt}>
      <div><dt>{tx("Nr zamówienia", "Order no.")}</dt><dd className={styles.mono}>{shortRef(pass.ref)}</dd></div>
      <div><dt>{tx("Produkt", "Product")}</dt><dd>{productName(tx, pass.productId)}</dd></div>
      <div>
        <dt>{tx("Kwota", "Amount")}</dt>
        <dd>{price(language, pass.priceMinor, pass.currency)} {tx("brutto", "gross")} {demo && <span className={styles.muted}>{tx("(demo: nic nie pobrano)", "(demo: nothing charged)")}</span>}</dd>
      </div>
      <div><dt>{tx("Metoda", "Method")}</dt><dd>{methodLabel(tx, pass.method)}{demo ? ` ${tx("(symulacja)", "(simulated)")}` : ""}</dd></div>
      <div><dt>{tx("Ważny do", "Valid until")}</dt><dd>{pass.lifetime || !pass.expiresAt ? tx("Dostęp bez limitu", "Unlimited access") : passDate(language, pass.expiresAt, true)}</dd></div>
      <div><dt>{tx("Zgoda na dostęp od razu", "Consent to immediate access")}</dt><dd>{passDate(language, pass.waiverAt, true)}</dd></div>
      <div><dt>{tx("Sprzedawca", "Seller")}</dt><dd>{sellerName(tx)}</dd></div>
    </dl>
  );
}

export const PassSuccess = forwardRef<HTMLHeadingElement, { tx: Tx; language: Locale; pass: ActivePass; onWatch: () => void; watchLabel?: string }>(
  function PassSuccess({ tx, language, pass, onWatch, watchLabel }, headingRef) {
    return (
      <div className={styles.result} role="status" aria-live="polite">
        <div className={cn(styles.check, styles.checkAnim)}><CheckIcon animated /></div>
        <h3 ref={headingRef} tabIndex={-1} className={styles.resultTitle}>{tx("Jesteś patronem. Dziękuję!", "You are a patron. Thank you!")}</h3>
        <p className={styles.resultText}>
          {pass.lifetime || !pass.expiresAt
            ? tx("Masz dostęp bez limitu.", "You have unlimited access.")
            : tx("Strefa patrona jest otwarta do {0}.", "The patron zone is open until {0}.", passDate(language, pass.expiresAt, true))}
        </p>
        <button type="button" className={cn(styles.goldBtn, styles.wide)} onClick={onWatch} data-autofocus="">
          <PlayIcon />
          {watchLabel ?? tx("Wejdź do strefy patrona", "Enter the patron zone")}
        </button>
        <PassReceipt tx={tx} language={language} pass={pass} />
        <p className={styles.fine}>
          {pass.provider === "DEMO"
            ? tx(
                "W prawdziwej sprzedaży to potwierdzenie przyszłoby e-mailem (trwały nośnik). Znajdziesz je też w „Moje konto → Strefa patrona”.",
                "In a real sale this confirmation would arrive by e-mail (durable medium). You can also find it in “My account → Patron zone”.",
              )
            : tx("Potwierdzenie znajdziesz też w „Moje konto → Strefa patrona”.", "You can also find this confirmation in “My account → Patron zone”.")}
        </p>
      </div>
    );
  },
);

/** The payment was sent but is not recorded yet (a bank still confirming, the webhook on its way). */
export const PassPending = forwardRef<HTMLHeadingElement, { tx: Tx; timedOut: boolean; onCheck: () => void; onClose: () => void }>(
  function PassPending({ tx, timedOut, onCheck, onClose }, headingRef) {
    return (
      <div className={styles.result} role="status" aria-live="polite">
        <div className={styles.progress} aria-hidden={timedOut || undefined}><span>{timedOut ? "…" : tx("Potwierdzam płatność…", "Confirming your payment…")}</span></div>
        <h3 ref={headingRef} tabIndex={-1} className={styles.resultTitle}>
          {timedOut ? tx("Trwa to dłużej niż zwykle", "This is taking longer than usual") : tx("Chwileczkę…", "One moment…")}
        </h3>
        <p className={styles.resultText}>
          {timedOut
            ? tx("Dostęp pojawi się sam, gdy bank potwierdzi płatność. Nie musisz płacić ponownie.", "Access appears by itself once your bank confirms the payment. There is no need to pay again.")
            : tx("To zajmie tylko chwilę. Nie zamykaj okna.", "This only takes a moment. Do not close this window.")}
        </p>
        {timedOut && (
          <div className={styles.row}>
            <button type="button" className={styles.lineBtn} onClick={onClose}>{tx("Zamknij", "Close")}</button>
            <button type="button" className={styles.inkBtn} style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={onCheck} data-autofocus="">{tx("Sprawdź ponownie", "Check again")}</button>
          </div>
        )}
      </div>
    );
  },
);

export const PassDeclined = forwardRef<HTMLHeadingElement, { tx: Tx; onRetry: () => void; onChangeMethod: () => void; retryLabel?: string }>(
  function PassDeclined({ tx, onRetry, onChangeMethod, retryLabel }, headingRef) {
    return (
      <div className={styles.result} role="alert">
        <div className={cn(styles.check, styles.declined)}><CrossIcon /></div>
        <h3 ref={headingRef} tabIndex={-1} className={styles.resultTitle}>{tx("Płatność nie przeszła", "The payment did not go through")}</h3>
        <p className={styles.resultText}>{tx("Płatność nie przeszła. Nic nie zostało pobrane.", "The payment did not go through. Nothing was charged.")}</p>
        <div className={styles.row}>
          <button type="button" className={styles.lineBtn} onClick={onChangeMethod}>{tx("Zmień metodę", "Change method")}</button>
          <button type="button" className={styles.inkBtn} style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={onRetry} data-autofocus="">
            {retryLabel ?? tx("Spróbuj ponownie", "Try again")}
          </button>
        </div>
      </div>
    );
  },
);

/** Access is already booked for the longest allowed period: no further payment is taken. */
export const PassMaxAhead = forwardRef<HTMLHeadingElement, { tx: Tx; language: Locale; expiresAt?: string; lifetime?: boolean; onWatch: () => void }>(
  function PassMaxAhead({ tx, language, expiresAt, lifetime, onWatch }, headingRef) {
    return (
      <div className={styles.result} role="status" aria-live="polite">
        <div className={styles.check}><CheckIcon /></div>
        <h3 ref={headingRef} tabIndex={-1} className={styles.resultTitle}>{lifetime ? tx("Masz już dostęp bez limitu", "You already have unlimited access") : tx("Masz już dostęp na długo", "You already have long-term access")}</h3>
        {expiresAt && <p className={styles.resultText}>{tx("Strefa patrona jest otwarta do {0}. Możesz wpłacić ponownie bliżej tej daty.", "The patron zone is open until {0}. You can pay again closer to that date.", passDate(language, expiresAt, true))}</p>}
        <button type="button" className={cn(styles.goldBtn, styles.wide)} onClick={onWatch} data-autofocus="">
          <PlayIcon />
          {tx("Wejdź do strefy patrona", "Enter the patron zone")}
        </button>
      </div>
    );
  },
);
