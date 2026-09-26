"use client";

import React, { useEffect, useRef, useState } from "react";
import { CardElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { PaymentIntentResult, PaymentRequest, Stripe } from "@stripe/stripe-js";
import type { SupportedCurrency } from "@/lib/constants";
import { MAIN_CREATOR_NAME } from "@/lib/constants";
import { Loader2 } from "../icons";
import { buildTipReturnUrl, readConfirmResult, type TipConfirmOutcome } from "./tip-confirm";
import { TIP_FALLBACK_METHOD, describeTipMethod, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipPayStepProps {
  language: string;
  amount: number;
  currency: SupportedCurrency;
  method: string;
  clientSecret: string;
  paymentId: string | null;
  userEmail?: string;
  stripePromise: Promise<Stripe | null> | null;
  onChangeMethod: () => void;
  onConfirmed: (outcome: TipConfirmOutcome) => void;
}

/**
 * The last step: a form for the method picked on "Metoda napiwku" only, confirmed against the
 * same automatic intent with that method's Stripe.js confirm call. Methods without a dedicated
 * form (added later in the Stripe dashboard) get Stripe's Payment Element limited to that one
 * method; only the "Karta i inne" fallback tile shows Stripe's full list.
 * Must render inside <Elements> bound to the intent.
 */
export function TipPayStep(props: TipPayStepProps) {
  const { method } = props;
  if (method === "blik") return <BlikForm {...props} />;
  if (method === "p24") return <RedirectForm {...props} />;
  if (method === "card") return <CardForm {...props} />;
  if (method === "apple_pay" || method === "google_pay") return <WalletForm {...props} />;
  if (method === TIP_FALLBACK_METHOD) return <FallbackForm {...props} />;
  return <SingleMethodForm {...props} />;
}

/** Heading + "20 zł · BLIK · Zmień" strip shared by every per-method form. */
function PayStepFrame({
  props,
  footer,
  children,
}: {
  props: TipPayStepProps;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { language, amount, currency, method, onChangeMethod } = props;
  const isPl = language === "pl";
  const copy = describeTipMethod(method, isPl);
  return (
    <TipStepLayout footer={footer}>
      <TipStepHeading title={copy.title} />
      <div className="mb-5 flex items-center justify-between gap-3 rounded-[14px] bg-[var(--chan-amber-soft)] px-4 py-3">
        <p className="m-0 text-[14px] font-bold text-[var(--chan-ink)]">
          <span className="tabular-nums">{formatTipAmount(amount, currency, language)}</span>
          <span className="mx-1.5 text-[var(--chan-muted)]">·</span>
          {copy.title}
        </p>
        <button type="button" onClick={onChangeMethod} className="text-[13px] font-bold text-[var(--chan-blue)] hover:underline">
          {isPl ? "Zmień" : "Change"}
        </button>
      </div>
      {children}
    </TipStepLayout>
  );
}

/** Shared submit state + result handling for the per-method forms. */
function useTipConfirm(isPl: boolean, onConfirmed: (outcome: TipConfirmOutcome) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (confirm: () => Promise<PaymentIntentResult>) => {
    setBusy(true);
    setError(null);
    const read = readConfirmResult(await confirm(), isPl);
    setBusy(false);
    if ("outcome" in read) onConfirmed(read.outcome);
    else setError(read.error);
  };
  return { busy, error, run };
}

function SendButton({ busy, disabled, label, isPl, onClick }: { busy: boolean; disabled?: boolean; label: string; isPl: boolean; onClick: () => void }) {
  return (
    <TipPrimaryButton onClick={onClick} disabled={disabled || busy} busy={busy}>
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {isPl ? "Wysyłam…" : "Sending…"}
        </>
      ) : (
        label
      )}
    </TipPrimaryButton>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-center text-[13px] font-medium text-red-600">
      {error}
    </p>
  );
}

function toMinor(amount: number) {
  return Math.round(amount * 100);
}

function sendLabel(isPl: boolean, amount: number, currency: SupportedCurrency, language: string) {
  const formatted = formatTipAmount(amount, currency, language);
  return isPl ? `Wyślij ${formatted}` : `Send ${formatted}`;
}

function BlikForm(props: TipPayStepProps) {
  const { language, amount, currency, clientSecret, onConfirmed } = props;
  const isPl = language === "pl";
  const stripe = useStripe();
  const [code, setCode] = useState("");
  const { busy, error, run } = useTipConfirm(isPl, onConfirmed);
  const valid = /^\d{6}$/.test(code);

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton
          busy={busy}
          disabled={!valid || !stripe}
          isPl={isPl}
          label={sendLabel(isPl, amount, currency, language)}
          onClick={() =>
            stripe &&
            run(() =>
              stripe.confirmBlikPayment(clientSecret, {
                payment_method: { blik: {} },
                payment_method_options: { blik: { code } },
              }),
            )
          }
        />
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-[var(--chan-body)]">
          {isPl ? "Kod BLIK z aplikacji banku" : "BLIK code from your banking app"}
        </span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-label={isPl ? "Kod BLIK" : "BLIK code"}
          className="h-16 w-full rounded-[14px] border-2 border-[var(--chan-line)] bg-white text-center text-[28px] font-extrabold tracking-[0.35em] tabular-nums text-[var(--chan-ink)] outline-none placeholder:text-[var(--chan-line-soft)] focus:border-[var(--chan-blue)]"
        />
      </label>
      <p className="mt-2 text-[12px] text-[var(--chan-muted)]">
        {isPl ? "Po wysłaniu potwierdź napiwek w aplikacji banku." : "After sending, confirm the tip in your banking app."}
      </p>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

function RedirectForm(props: TipPayStepProps) {
  const { language, clientSecret, paymentId, userEmail, onConfirmed } = props;
  const isPl = language === "pl";
  const stripe = useStripe();
  const { busy, error, run } = useTipConfirm(isPl, onConfirmed);

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton
          busy={busy}
          disabled={!stripe || !userEmail}
          isPl={isPl}
          label={isPl ? "Przejdź do Przelewy24" : "Continue to Przelewy24"}
          onClick={() =>
            stripe &&
            userEmail &&
            run(() =>
              stripe.confirmP24Payment(clientSecret, {
                payment_method: { billing_details: { email: userEmail } },
                return_url: buildTipReturnUrl(paymentId),
              }),
            )
          }
        />
      }
    >
      <p className="text-[14px] leading-[1.6] text-[var(--chan-body)]">
        {isPl
          ? "Przeniesiemy Cię do Przelewy24, gdzie wybierzesz swój bank. Po zapłacie wrócisz tutaj."
          : "You'll go to Przelewy24 to pick your bank, then come right back here."}
      </p>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

function CardForm(props: TipPayStepProps) {
  // The card field needs its own Elements group: Elements bound to a PaymentIntent secret
  // are reserved for the Payment/Express Checkout Elements.
  return (
    <Elements stripe={props.stripePromise} options={{ locale: props.language === "pl" ? "pl" : "en" }}>
      <CardFormInner {...props} />
    </Elements>
  );
}

function CardFormInner(props: TipPayStepProps) {
  const { language, amount, currency, clientSecret, userEmail, onConfirmed } = props;
  const isPl = language === "pl";
  const stripe = useStripe();
  const elements = useElements();
  const [complete, setComplete] = useState(false);
  const { busy, error, run } = useTipConfirm(isPl, onConfirmed);

  const send = () => {
    const card = elements?.getElement(CardElement);
    if (!stripe || !card) return;
    void run(() =>
      stripe.confirmCardPayment(clientSecret, {
        payment_method: { card, ...(userEmail ? { billing_details: { email: userEmail } } : {}) },
      }),
    );
  };

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton busy={busy} disabled={!complete || !stripe} isPl={isPl} label={sendLabel(isPl, amount, currency, language)} onClick={send} />
      }
    >
      <div className="rounded-[14px] border-2 border-[var(--chan-line)] bg-white px-4 py-4 focus-within:border-[var(--chan-blue)]">
        <CardElement
          onChange={(event) => setComplete(event.complete)}
          options={{
            hidePostalCode: true,
            style: { base: { fontSize: "16px", color: "#1a1a1a", "::placeholder": { color: "#9ca3af" } } },
          }}
        />
      </div>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

/** Stripe's Payment Element; `deferred` when it sits in its own Elements group limited to one method. */
function FallbackForm({ deferred, ...props }: TipPayStepProps & { deferred?: boolean }) {
  const { language, amount, currency, clientSecret, paymentId, userEmail, onConfirmed } = props;
  const isPl = language === "pl";
  const stripe = useStripe();
  const elements = useElements();
  const { busy, error, run } = useTipConfirm(isPl, onConfirmed);

  const send = () =>
    stripe &&
    elements &&
    run(async () => {
      if (deferred) {
        const { error: submitError } = await elements.submit();
        if (submitError) return { error: submitError } as PaymentIntentResult;
      }
      return stripe.confirmPayment({
        elements,
        ...(deferred ? { clientSecret } : {}),
        confirmParams: {
          return_url: buildTipReturnUrl(paymentId),
          ...(userEmail ? { payment_method_data: { billing_details: { email: userEmail } } } : {}),
        },
        redirect: "if_required",
      });
    });

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton busy={busy} disabled={!stripe || !elements} isPl={isPl} label={sendLabel(isPl, amount, currency, language)} onClick={send} />
      }
    >
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false },
          business: { name: MAIN_CREATOR_NAME },
          wallets: { applePay: "never", googlePay: "never", link: "never" },
          fields: { billingDetails: { email: userEmail ? "never" : "auto" } },
        }}
      />
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

/** Apple Pay / Google Pay via the browser's payment sheet, opened by our own send button. */
function WalletForm(props: TipPayStepProps) {
  const { language, amount, currency, method, clientSecret, onConfirmed } = props;
  const isPl = language === "pl";
  const stripe = useStripe();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onConfirmedRef = useRef(onConfirmed);
  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  }, [onConfirmed]);

  useEffect(() => {
    if (!stripe) return;
    let active = true;
    const paymentRequest = stripe.paymentRequest({
      country: "PL",
      currency: currency.toLowerCase(),
      total: { label: MAIN_CREATOR_NAME, amount: toMinor(amount) },
      disableWallets: ["link", "browserCard", method === "apple_pay" ? "googlePay" : "applePay"],
    });
    paymentRequest.on("paymentmethod", async (event) => {
      const first = await stripe.confirmCardPayment(clientSecret, { payment_method: event.paymentMethod.id }, { handleActions: false });
      event.complete(first.error ? "fail" : "success");
      const result = !first.error && first.paymentIntent?.status === "requires_action" ? await stripe.confirmCardPayment(clientSecret) : first;
      const read = readConfirmResult(result, isPl);
      setBusy(false);
      if ("outcome" in read) onConfirmedRef.current(read.outcome);
      else setError(read.error);
    });
    paymentRequest.on("cancel", () => setBusy(false));
    void paymentRequest.canMakePayment().then((result) => {
      if (!active) return;
      if (result) setRequest(paymentRequest);
      else setUnavailable(true);
    });
    return () => {
      active = false;
    };
  }, [stripe, clientSecret, amount, currency, method, isPl]);

  const send = () => {
    if (!request) return;
    setError(null);
    setBusy(true);
    request.show();
  };

  return (
    <PayStepFrame
      props={props}
      footer={<SendButton busy={busy} disabled={!request} isPl={isPl} label={sendLabel(isPl, amount, currency, language)} onClick={send} />}
    >
      <p className="text-[14px] leading-[1.6] text-[var(--chan-body)]">
        {unavailable
          ? isPl
            ? "Ta metoda nie jest dostępna na tym urządzeniu. Wróć i wybierz inną."
            : "This method isn't available on this device. Go back and pick another one."
          : isPl
            ? "Po kliknięciu otworzy się okno portfela, w którym potwierdzisz napiwek."
            : "Your wallet will open so you can confirm the tip."}
      </p>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

/** A method without our own form: Stripe's Payment Element showing only that method. */
function SingleMethodForm(props: TipPayStepProps) {
  const { language, amount, currency, method } = props;
  return (
    <Elements
      stripe={props.stripePromise}
      options={{
        mode: "payment",
        amount: toMinor(amount),
        currency: currency.toLowerCase(),
        paymentMethodTypes: [method],
        locale: language === "pl" ? "pl" : "en",
      }}
    >
      <FallbackForm {...props} deferred />
    </Elements>
  );
}
