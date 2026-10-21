"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.3): the checkout of the patron zone, in two
// steps. Step 1: a choice of two fixed options, the payment method (the tip gateway's dropdown) and the Terms / Privacy
// Policy as links. Step 2: the payment of the chosen method (the tip gateway's own forms, real Stripe) and the two
// boxes. In demo mode (the default) step 2 has no payment form and the server simulates the payment. Access is NEVER
// granted from here: the server grants it when Stripe confirms the payment; this component only waits and displays.
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { Stripe } from "@stripe/stripe-js";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth/react";
import { getStripeBrowser } from "@/lib/payments/stripe-browser";
import { defaultProduct, type PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { maskEmail, type PassMethod, type PassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";
import { useLanguage } from "../LanguageContext";
import { TIP_WALLETS, getTipMethodTiles, readLastTipMethod, rememberTipMethod, type TipWallet } from "../support/tip-flow-config";
import { TipBackContext } from "../support/TipStepLayout";
import { CrossIcon } from "./PassIcons";
import { PassOptionStep } from "./PassOptionStep";
import { PassConsent, PassDemoSummary, PassStripePay, type PassConsentErrors, type PassConsentState } from "./PassPaymentStep";
import { PassDeclined, PassMaxAhead, PassPending, PassSuccess } from "./PassSuccess";
import { newRequestId, passDate, price } from "./pass-copy";
import { fetchPassStatus, pollPatronPayment, postDemoCheckout, postPatronConsent, postPatronIntent } from "./usePremiumPass";
import styles from "./premium-pass.module.css";

type ActivePass = Exclude<PassStatusDto, { state: "none" }>;

type Stage =
  | { kind: "amount" }
  | { kind: "pay" }
  | { kind: "processing" }
  | { kind: "success"; pass: ActivePass }
  | { kind: "pending"; paymentId: string; timedOut: boolean }
  | { kind: "declined" }
  | { kind: "max-ahead"; expiresAt?: string; lifetime?: boolean };

/** Query parameter of the return URL of redirect methods (Przelewy24, bank redirects). */
export const PASS_PAYMENT_PARAM = "pass_payment";
const RETURN_PARAMS = [PASS_PAYMENT_PARAM, "payment_intent", "payment_intent_client_secret", "redirect_status", "pass"];
const ATTEMPT_KEY = "pp:patron-attempt-id";
const DEMO_PROCESSING_MS = 1_200;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One attempt = one request id = one PaymentIntent on the server (kept for the tab, like the tip gateway's). */
function attemptId(): string {
  try {
    const stored = window.sessionStorage.getItem(ATTEMPT_KEY);
    if (stored) return stored;
    const fresh = newRequestId();
    window.sessionStorage.setItem(ATTEMPT_KEY, fresh);
    return fresh;
  } catch {
    return newRequestId();
  }
}

function resetAttempt() {
  try {
    window.sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // storage blocked: the next attempt simply gets a new id
  }
}

/** Demo mode has no Stripe to ask, so the wallets are guessed from the browser (as the old method tiles did). */
function guessWallets(): TipWallet[] {
  const w = window as unknown as { ApplePaySession?: unknown };
  const chromium = /Chrome|CriOS|Android/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
  return [...(w.ApplePaySession ? (["apple_pay"] as const) : []), ...(chromium ? (["google_pay"] as const) : [])];
}

function buildReturnUrl(paymentId: string): string {
  const url = new URL(window.location.href);
  RETURN_PARAMS.forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  url.searchParams.set(PASS_PAYMENT_PARAM, paymentId);
  return url.toString();
}

export interface PassCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: PremiumPassOffer;
  /** Preselects an option (the offer page cards). */
  initialProductId?: string;
  /** "Enter the patron zone" after a success (refreshes the playback plan). */
  onWatch: () => void;
  watchLabel?: string;
}

export function PassCheckoutSheet({ open, onOpenChange, offer, initialProductId, onWatch, watchLabel }: PassCheckoutSheetProps) {
  const { tx, language } = useLanguage();
  const { user } = useUser();
  const ids = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const waiverRef = useRef<HTMLInputElement>(null);
  const returnedPaymentRef = useRef<string | null>(null);
  const returnedFailedRef = useRef(false);
  const cancelledRef = useRef(false);

  const stripeMode = offer.payments.mode === "stripe";
  const stripeReady = offer.payments.mode === "stripe" && offer.payments.available;
  const testMode = offer.payments.mode === "stripe" && offer.payments.available && offer.payments.stripeMode === "test";

  const [productId, setProductId] = useState<string>(initialProductId ?? defaultProduct(offer).id);
  const product = offer.products.find((p) => p.id === productId) ?? defaultProduct(offer);
  const [stage, setStage] = useState<Stage>({ kind: "amount" });
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [wallets, setWallets] = useState<TipWallet[]>([]);
  const [stripeTypes, setStripeTypes] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [intent, setIntent] = useState<{ paymentId: string; clientSecret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [consent, setConsent] = useState<PassConsentState>({ terms: false, waiver: false });
  const [consentErrors, setConsentErrors] = useState<PassConsentErrors>({});
  const [access, setAccess] = useState<{ lifetime: boolean; expiresAt: string | null } | null>(null);

  const methods = useMemo(
    () => (stripeReady ? getTipMethodTiles(stripeTypes ?? ["blik", "card", "p24"], wallets, false) : getTipMethodTiles(["blik", "card", "p24"], wallets, false)),
    [stripeReady, stripeTypes, wallets],
  );
  const method = picked && methods.includes(picked) ? picked : (() => {
    const last = readLastTipMethod();
    return last && methods.includes(last) ? last : methods[0] ?? null;
  })();
  const amountMinor = product.priceMinor;
  const total = price(language, amountMinor);
  const processing = stage.kind === "processing";
  const locked = busy || processing;
  const email = maskEmail(user?.primaryEmailAddress?.emailAddress);
  const formatDate = (iso: string) => passDate(language, iso, true);

  // ---- opening: a fresh attempt (or the return from a redirect method), Stripe.js only from here
  const finish = useCallback(async (paymentId: string, attempts: number) => {
    setStage({ kind: "processing" });
    const result = await pollPatronPayment(paymentId, { attempts, isCancelled: () => cancelledRef.current });
    if (cancelledRef.current) return;
    if (result === "FAILED") {
      setStage({ kind: "declined" });
      return;
    }
    if (result === "SUCCEEDED") {
      resetAttempt();
      const status = await fetchPassStatus();
      if (status && status.pass.state === "active") {
        setStage({ kind: "success", pass: status.pass });
        return;
      }
    }
    setStage({ kind: "pending", paymentId, timedOut: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;
    setBusy(false);
    setProductId(initialProductId ?? defaultProduct(offer).id);
    setNotice(null);
    setConsent({ terms: false, waiver: false });
    setConsentErrors({});
    setIntent(null);
    setStripeTypes(null);
    setAccess(null);
    if (stripeReady) {
      // The first and only place that asks for Stripe.js: the checkout was opened.
      const promise = getStripeBrowser();
      setStripePromise(promise);
      promise
        .then((stripe) => stripe?.paymentRequest({ country: "PL", currency: "pln", total: { label: "Patron", amount: 100 }, disableWallets: ["link", "browserCard"] }).canMakePayment())
        .then((result) => { if (!cancelledRef.current) setWallets(TIP_WALLETS.filter((wallet) => (wallet === "apple_pay" ? result?.applePay : result?.googlePay))); })
        .catch(() => undefined);
    } else {
      setWallets(guessWallets());
    }
    if (returnedFailedRef.current) {
      returnedFailedRef.current = false;
      setStage({ kind: "declined" });
      return () => { cancelledRef.current = true; };
    }
    const returned = returnedPaymentRef.current;
    if (returned) {
      returnedPaymentRef.current = null;
      void finish(returned, 10);
      return () => { cancelledRef.current = true; };
    }
    setStage({ kind: "amount" });
    void fetchPassStatus("checkout").then((status) => {
      if (cancelledRef.current) return;
      if (status?.pass.state === "active") setAccess({ lifetime: status.pass.lifetime, expiresAt: status.pass.expiresAt });
    });
    return () => { cancelledRef.current = true; };
    // Only on opening: a re-render of the parent (new offer object) must not reset an attempt in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Back from a redirect method (Przelewy24...): reopen the checkout on the waiting screen and strip our parameters.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const returned = url.searchParams.get(PASS_PAYMENT_PARAM);
      if (!returned) return;
      const status = url.searchParams.get("redirect_status");
      RETURN_PARAMS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", url.toString());
      if (status === "failed") {
        returnedFailedRef.current = true;
        onOpenChange(true);
        return;
      }
      returnedPaymentRef.current = returned;
      onOpenChange(true);
    } catch {
      // ignore: the viewer just sees the page
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus follows the step: the heading of the new step takes focus, screen readers announce it.
  const firstStage = useRef(true);
  useEffect(() => {
    if (firstStage.current) {
      firstStage.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [stage.kind]);

  // ---- step 1 -> 2
  const next = async () => {
    setNotice(null);
    if (!method || access?.lifetime) return;
    if (stripeMode && !stripeReady) {
      // Never falls back to the simulated payment: that would hand out access for no money.
      setNotice(tx("Płatności są chwilowo niedostępne. Spróbuj ponownie później.", "Payments are temporarily unavailable. Please try again later."));
      return;
    }
    if (!stripeReady) {
      setStage({ kind: "pay" });
      return;
    }
    setBusy(true);
    let outcome = await postPatronIntent({ requestId: attemptId(), productId: product.id });
    if (outcome.kind === "terminal") {
      resetAttempt();
      outcome = await postPatronIntent({ requestId: attemptId(), productId: product.id });
    }
    setBusy(false);
    if (cancelledRef.current) return;
    if (outcome.kind === "ready") {
      const tiles = getTipMethodTiles(outcome.paymentMethodTypes, wallets, false);
      setStripeTypes(outcome.paymentMethodTypes);
      if (!tiles.includes(method)) {
        setPicked(tiles[0] ?? null);
        setNotice(tx("Ta metoda nie jest dostępna dla tej płatności. Wybierz inną.", "This method is not available for this payment. Please choose another."));
        return;
      }
      setIntent({ paymentId: outcome.paymentId, clientSecret: outcome.clientSecret });
      rememberTipMethod(method);
      setStage({ kind: "pay" });
    } else if (outcome.kind === "max-ahead") {
      setStage({ kind: "max-ahead", expiresAt: outcome.expiresAt, lifetime: outcome.lifetime });
    } else if (outcome.kind === "in-progress") {
      setNotice(tx("Ta płatność jest właśnie opłacana (np. czeka na potwierdzenie w banku). Dokończ ją albo spróbuj za kilka minut.", "This payment is being paid right now (e.g. waiting for your bank). Finish it or try again in a few minutes."));
    } else if (outcome.kind === "unavailable") {
      setNotice(tx("Płatności są chwilowo niedostępne. Spróbuj ponownie później.", "Payments are temporarily unavailable. Please try again later."));
    } else {
      setNotice(tx("Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.", "The payment could not be started. Please try again in a moment."));
    }
  };

  const backToAmount = () => setStage({ kind: "amount" });

  // ---- step 2: demo
  const payDemo = async () => {
    const missing = { terms: !consent.terms, waiver: !consent.waiver };
    setConsentErrors(missing);
    if (missing.terms || missing.waiver || !method) {
      const first = missing.terms ? termsRef.current : waiverRef.current;
      first?.focus();
      first?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      return;
    }
    setStage({ kind: "processing" });
    const [outcome] = await Promise.all([
      postDemoCheckout({ requestId: attemptId(), productId: product.id, method: method as PassMethod, simulate: "success" }),
      wait(DEMO_PROCESSING_MS),
    ]);
    if (cancelledRef.current) return;
    if (outcome.kind === "success" && outcome.pass.state !== "none") {
      resetAttempt();
      setStage({ kind: "success", pass: outcome.pass });
    } else if (outcome.kind === "declined") {
      resetAttempt();
      setStage({ kind: "declined" });
    } else if (outcome.kind === "max-ahead") {
      setStage({ kind: "max-ahead", expiresAt: outcome.expiresAt, lifetime: outcome.lifetime });
    } else {
      setStage({ kind: "declined" });
    }
  };

  // ---- step 2: Stripe
  const beforeConfirm = useCallback(
    () => (intent && method ? postPatronConsent({ paymentId: intent.paymentId, method }) : Promise.resolve(false)),
    [intent, method],
  );

  const watch = () => {
    onOpenChange(false);
    onWatch();
  };

  const stepNumber = stage.kind === "amount" ? 1 : stage.kind === "pay" ? 2 : null;
  const showSteps = stepNumber !== null;
  const retry = () => { resetAttempt(); setIntent(null); setStage({ kind: "amount" }); };

  const heading = (text: string) => (
    <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>{text}</h3>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!locked) onOpenChange(next); }} disablePointerDismissal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={styles.overlay} />
        <DialogPrimitive.Popup className={cn(styles.pass, styles.sheet)} aria-labelledby={`${ids}-title`} aria-busy={locked} initialFocus={titleRef}>
          <div className={styles.sheetHead}>
            <DialogPrimitive.Title render={<h2 ref={titleRef} tabIndex={-1} id={`${ids}-title`} className={styles.sheetTitle} />}>
              {tx("Zostań patronem", "Become a patron")}
              {testMode && <span className={styles.testBadge}>{tx("Tryb testowy", "Test mode")}</span>}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className={styles.close} disabled={locked} aria-label={tx("Zamknij", "Close")}>
              <CrossIcon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {showSteps && (
            <>
              <ol className={styles.steps} aria-label={tx("Etapy zakupu", "Checkout steps")}>
                <li aria-current={stepNumber === 1 ? "step" : undefined} className={cn(styles.stepItem, stepNumber === 1 && styles.stepNow)}>
                  <span className={styles.stepDot} aria-hidden="true">1</span>{tx("Dostęp", "Access")}
                </li>
                <li aria-current={stepNumber === 2 ? "step" : undefined} className={cn(styles.stepItem, stepNumber === 2 && styles.stepNow)}>
                  <span className={styles.stepDot} aria-hidden="true">2</span>{tx("Płatność", "Payment")}
                </li>
              </ol>
              <p className={styles.srOnly} role="status" aria-live="polite">{tx("Krok {0} z 2", "Step {0} of 2", stepNumber)}</p>
            </>
          )}
          {testMode && stage.kind !== "success" && (
            <p className={styles.testNote}>{tx("Tryb testowy: nic nie zostanie pobrane naprawdę. Karta testowa: 4242 4242 4242 4242, dowolna data i CVC.", "Test mode: nothing is really charged. Test card: 4242 4242 4242 4242, any date and CVC.")}</p>
          )}

          {stage.kind === "amount" && (
            <>
              <div className={styles.sheetBody}>
                {heading(tx("Zostań patronem i uzyskaj dostęp do strefy premium", "Become a patron and get access to the premium zone"))}
                <PassOptionStep
                  tx={tx}
                  language={language}
                  offer={offer}
                  product={product}
                  onProduct={(id) => { setProductId(id); setNotice(null); }}
                  methods={methods}
                  method={method}
                  onMethod={(value) => { setPicked(value); setNotice(null); }}
                  access={access}
                  notice={notice}
                  unavailable={stripeMode && !stripeReady}
                  busy={busy}
                  formatDate={formatDate}
                />
              </div>
              <div className={styles.pay}>
                <button type="button" className={styles.inkBtn} onClick={() => void next()} disabled={busy || access?.lifetime === true || (stripeMode && !stripeReady)} aria-busy={busy || undefined}>
                  {busy ? tx("Chwileczkę…", "One moment…") : tx("Dalej · {0}", "Next · {0}", total)}
                </button>
              </div>
            </>
          )}

          {stage.kind === "pay" && method && stripeReady && intent && (
            <>
              <div className={styles.payHead}>{heading(tx("Płatność", "Payment"))}</div>
              <TipBackContext.Provider value={{ onBack: backToAmount, label: tx("Wstecz", "Back") }}>
                <PassStripePay
                  language={language}
                  amountMinor={amountMinor}
                  method={method}
                  clientSecret={intent.clientSecret}
                  paymentId={intent.paymentId}
                  userEmail={user?.primaryEmailAddress?.emailAddress}
                  stripePromise={stripePromise}
                  returnUrl={buildReturnUrl(intent.paymentId)}
                  accepted={consent.terms && consent.waiver}
                  beforeConfirm={beforeConfirm}
                  onChangeMethod={backToAmount}
                  onConfirmed={(outcome) => void finish(intent.paymentId, outcome === "succeeded" ? 6 : 10)}
                  consent={<PassConsent tx={tx} language={language} ids={ids} value={consent} errors={consentErrors} onChange={(value) => { setConsent(value); setConsentErrors({}); }} />}
                />
              </TipBackContext.Provider>
            </>
          )}

          {stage.kind === "pay" && method && !stripeMode && (
            <>
              <div className={styles.sheetBody}>
                {heading(tx("Płatność", "Payment"))}
                <PassDemoSummary tx={tx} language={language} amountMinor={amountMinor} method={method} onChangeMethod={backToAmount} />
                <PassConsent tx={tx} language={language} ids={ids} value={consent} errors={consentErrors} onChange={(value) => { setConsent(value); setConsentErrors({}); }} termsRef={termsRef} waiverRef={waiverRef} />
                {email && <p className={styles.muted} style={{ margin: 0 }}>{tx("Potwierdzenie trafi na {0}", "The confirmation goes to {0}", email)}</p>}
              </div>
              <div className={styles.pay}>
                <button type="button" className={styles.inkBtn} onClick={() => void payDemo()}>
                  {tx("Zapłać {0}", "Pay {0}", total)}
                </button>
              </div>
            </>
          )}

          {(stage.kind === "processing" || stage.kind === "success" || stage.kind === "pending" || stage.kind === "declined" || stage.kind === "max-ahead") && (
            <div className={styles.sheetBody}>
              {stage.kind === "processing" && (
                <PassPending ref={headingRef} tx={tx} timedOut={false} onCheck={() => undefined} onClose={() => onOpenChange(false)} />
              )}
              {stage.kind === "success" && <PassSuccess ref={headingRef} tx={tx} language={language} pass={stage.pass} onWatch={watch} watchLabel={watchLabel} />}
              {stage.kind === "pending" && (
                <PassPending ref={headingRef} tx={tx} timedOut={stage.timedOut} onCheck={() => void finish(stage.paymentId, 4)} onClose={() => onOpenChange(false)} />
              )}
              {stage.kind === "declined" && <PassDeclined ref={headingRef} tx={tx} onRetry={retry} onChangeMethod={retry} />}
              {stage.kind === "max-ahead" && <PassMaxAhead ref={headingRef} tx={tx} language={language} expiresAt={stage.expiresAt} lifetime={stage.lifetime} onWatch={watch} />}
            </div>
          )}

          <div className={styles.seller}>
            <span>{tx("Sprzedawca: {0}", "Seller: {0}", "POLUTEK Sp. z o.o.")}</span>
            <span>support@pawelperfect.com</span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
