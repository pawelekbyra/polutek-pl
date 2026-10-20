"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.3): the simulated checkout. One screen: the
// total is always visible and repeated on the button. NEVER takes money: no payment provider, no card/BLIK fields;
// the server answers a simulated success or decline (provider DEMO).
import React, { useEffect, useId, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth/react";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { txRich } from "@/lib/i18n/rich";
import type { PremiumPassOffer, PassOfferProduct } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { defaultProduct } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { maskEmail, type PassMethod, type PassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";
import { useLanguage } from "../LanguageContext";
import { CrossIcon, ShieldIcon, TicketIcon } from "./PassIcons";
import { PassMethodPicker, usePassMethods } from "./PassMethodPicker";
import { PassAlreadyActive, PassDeclined, PassSuccess } from "./PassSuccess";
import { newRequestId, passDate, passName, price, sellerLine, vatLine } from "./pass-copy";
import { fetchPassStatus, postDemoCheckout } from "./usePremiumPass";
import styles from "./premium-pass.module.css";

type Step =
  | { kind: "form" }
  | { kind: "processing" }
  | { kind: "success"; pass: Exclude<PassStatusDto, { state: "none" }> }
  | { kind: "declined" }
  | { kind: "already"; expiresAt?: string }
  | { kind: "error" };

const PROCESSING_MS = 1_200;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PassCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: PremiumPassOffer;
  initialProductId?: string;
  /** "Watch now" after a success (refreshes the playback plan). */
  onWatch: () => void;
  watchLabel?: string;
}

export function PassCheckoutSheet({ open, onOpenChange, offer, initialProductId, onWatch, watchLabel }: PassCheckoutSheetProps) {
  const { tx, language } = useLanguage();
  const { user } = useUser();
  const methods = usePassMethods();
  const ids = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const waiverRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef<string>(newRequestId());
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [productId, setProductId] = useState<string>(initialProductId ?? defaultProduct(offer).id);
  const [method, setMethod] = useState<PassMethod>("blik");
  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [errors, setErrors] = useState<{ terms?: boolean; waiver?: boolean }>({});

  useEffect(() => {
    if (!open) return;
    // A fresh attempt each time the sheet opens; the status read also counts "checkout_open" (anonymous).
    requestIdRef.current = newRequestId();
    setStep({ kind: "form" });
    setErrors({});
    setProductId(initialProductId ?? defaultProduct(offer).id);
    void fetchPassStatus("checkout").then((status) => {
      if (status?.pass.state === "active") setStep({ kind: "already", expiresAt: status.pass.expiresAt });
    });
    // Only on opening: a re-render of the parent (new offer object) must not reset an attempt in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const product: PassOfferProduct = offer.products.find((p) => p.id === productId) ?? defaultProduct(offer);
  const total = price(language, product.priceMinor);
  const validUntil = passDate(language, new Date(Date.now() + product.days * 86_400_000).toISOString());
  const email = maskEmail(user?.primaryEmailAddress?.emailAddress);
  const busy = step.kind === "processing";
  const termsHref = getLocalizedHref(language, "passTerms");
  const privacyHref = getLocalizedHref(language, "privacy");

  const submit = async (simulate: "success" | "declined") => {
    const missing = { terms: !terms, waiver: !waiver };
    setErrors(missing);
    if (missing.terms || missing.waiver) {
      const first = missing.terms ? termsRef.current : waiverRef.current;
      first?.focus();
      first?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      return;
    }
    setStep({ kind: "processing" });
    const [outcome] = await Promise.all([
      postDemoCheckout({ requestId: requestIdRef.current, product: product.id, method, simulate }),
      wait(PROCESSING_MS),
    ]);
    if (outcome.kind === "success") setStep({ kind: "success", pass: outcome.pass as Exclude<PassStatusDto, { state: "none" }> });
    else if (outcome.kind === "declined") {
      requestIdRef.current = newRequestId();
      setStep({ kind: "declined" });
    } else if (outcome.kind === "already") setStep({ kind: "already", expiresAt: outcome.expiresAt });
    else if (outcome.kind === "consent") {
      setStep({ kind: "form" });
      setErrors({ terms: !terms, waiver: !waiver });
    } else setStep({ kind: "error" });
  };

  const consentError = tx("Zaznacz to pole, aby kontynuować.", "Tick this box to continue.");
  const watch = () => {
    onOpenChange(false);
    onWatch();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }} disablePointerDismissal={busy}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={styles.overlay} />
        <DialogPrimitive.Popup className={cn(styles.pass, styles.sheet)} aria-labelledby={`${ids}-title`} aria-busy={busy} initialFocus={titleRef}>
          <div className={styles.sheetHead}>
            <DialogPrimitive.Title render={<h2 ref={titleRef} tabIndex={-1} id={`${ids}-title`} className={styles.sheetTitle} />}>
              {tx("Kasa", "Checkout")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className={styles.close} disabled={busy} aria-label={tx("Zamknij", "Close")}>
              <CrossIcon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className={styles.sheetBody}>
            {step.kind === "success" && <PassSuccess tx={tx} language={language} pass={step.pass} onWatch={watch} watchLabel={watchLabel} />}
            {step.kind === "already" && <PassAlreadyActive tx={tx} language={language} expiresAt={step.expiresAt} onWatch={watch} />}
            {step.kind === "declined" && <PassDeclined tx={tx} onRetry={() => void submit("success")} onChangeMethod={() => setStep({ kind: "form" })} />}
            {step.kind === "error" && (
              <div className={styles.result} aria-live="polite">
                <h3 className={styles.resultTitle}>{tx("Coś poszło nie tak", "Something went wrong")}</h3>
                <p className={styles.resultText}>{tx("Nic nie zostało pobrane. Spróbuj ponownie za chwilę.", "Nothing was charged. Please try again in a moment.")}</p>
                <button type="button" className={styles.lineBtn} onClick={() => setStep({ kind: "form" })}>{tx("Wróć do kasy", "Back to checkout")}</button>
              </div>
            )}
            {(step.kind === "form" || step.kind === "processing") && (
              <>
                <fieldset className={styles.products} disabled={busy}>
                  <legend className={styles.label}>{tx("Wybierz wejściówkę", "Choose your pass")}</legend>
                  {offer.products.map((p) => (
                    <label key={p.id} className={styles.product}>
                      <input type="radio" name="pass-product" value={p.id} checked={p.id === product.id} onChange={() => setProductId(p.id)} />
                      {p.bestValue && <span className={styles.bestValue}>{tx("Najlepsza wartość", "Best value")}</span>}
                      <span className={styles.productName}>{passName(tx, p.id)}</span>
                      <span className={styles.productPrice}>{price(language, p.priceMinor)}</span>
                      <span className={styles.productNote}>{tx("jednorazowo, {0} dni", "one-time, {0} days", p.days)}</span>
                    </label>
                  ))}
                </fieldset>

                <div className={styles.order}>
                  <div className={styles.orderLine}>
                    <span className={styles.ticket}><TicketIcon /></span>
                    <div>
                      <b>{passName(tx, product.id)} · Premium</b>
                      <div className={styles.muted}>{tx("ważna do {0}, nie odnawia się", "valid until {0}, does not renew", validUntil)}</div>
                    </div>
                    <b>{total}</b>
                  </div>
                  <div className={styles.orderTotal}>
                    <span>{tx("Razem do zapłaty (brutto)", "Total to pay (incl. VAT)")}</span>
                    <b>{total}</b>
                  </div>
                </div>
                <p className={styles.muted} style={{ margin: "-6px 0 0" }}>
                  {vatLine(tx, offer.vatRatePercent)}
                  {email ? ` · ${tx("Potwierdzenie trafi na {0}", "The confirmation goes to {0}", email)}` : ""}
                </p>

                {step.kind === "processing" ? (
                  <>
                    <div className={styles.progress} aria-live="polite"><span>{tx("Łączę z operatorem płatności (demo)…", "Contacting the payment provider (demo)…")}</span></div>
                    <p className={styles.fine}>{tx("Nie zamykaj okna. To potrwa chwilę.", "Do not close this window. It only takes a moment.")}</p>
                  </>
                ) : (
                  <>
                    <PassMethodPicker tx={tx} methods={methods} value={method} onChange={setMethod} labelId={`${ids}-method`} />
                    <div className={cn(styles.consent, errors.terms && styles.consentError)}>
                      <input ref={termsRef} id={`${ids}-terms`} type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErrors((x) => ({ ...x, terms: false })); }} aria-invalid={errors.terms || undefined} aria-describedby={errors.terms ? `${ids}-terms-error` : undefined} />
                      <label htmlFor={`${ids}-terms`}>
                        {txRich(
                          tx,
                          "Akceptuję {0} i {1}.",
                          "I accept the {0} and the {1}.",
                          <a href={termsHref} target="_blank" rel="noopener">{tx("Regulamin wejściówki", "Pass Terms")}</a>,
                          <a href={privacyHref} target="_blank" rel="noopener">{tx("Politykę prywatności", "Privacy Policy")}</a>,
                        )}
                      </label>
                      {errors.terms && <p id={`${ids}-terms-error`} className={styles.error}>{consentError}</p>}
                    </div>
                    <div className={cn(styles.consent, errors.waiver && styles.consentError)}>
                      <input ref={waiverRef} id={`${ids}-waiver`} type="checkbox" checked={waiver} onChange={(e) => { setWaiver(e.target.checked); setErrors((x) => ({ ...x, waiver: false })); }} aria-invalid={errors.waiver || undefined} aria-describedby={errors.waiver ? `${ids}-waiver-error` : undefined} />
                      <label htmlFor={`${ids}-waiver`}>
                        {tx("Chcę dostępu od razu. Wiem, że gdy zacznę oglądać, tracę prawo odstąpienia od umowy.", "I want access right away. I understand that once I start watching, I lose my right to withdraw.")}
                      </label>
                      {errors.waiver && <p id={`${ids}-waiver-error`} className={styles.error}>{consentError}</p>}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {step.kind === "form" && (
            <div className={styles.pay}>
              <button type="button" className={styles.inkBtn} onClick={() => void submit("success")}>
                {tx("Zamawiam i płacę {0}", "Order and pay {0}", total)}
              </button>
              <small className={styles.payNote}>{tx("Demo: bez obciążenia", "Demo: no charge")}</small>
              <button type="button" className={styles.ghostBtn} onClick={() => void submit("declined")}>
                {tx("Symuluj odrzuconą płatność", "Simulate a declined payment")}
              </button>
            </div>
          )}
          <div className={styles.seller}>
            <ShieldIcon />
            <span>{tx("Bezpieczne połączenie", "Secure connection")} · {sellerLine(tx)} · support@pawelperfect.com</span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
