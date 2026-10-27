"use client";

import React, { useRef, useState } from "react";
import { CardElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { PaymentIntentResult } from "@stripe/stripe-js";
import type { SupportedCurrency } from "@/lib/constants";
import { APP_NAME } from "@/lib/constants";
import { Loader2 } from "../icons";
import { buildTipReturnUrl, readConfirmResult, type TipConfirmOutcome } from "./tip-confirm";
import { TIP_CRYPTO_PLACEHOLDER, TIP_FALLBACK_METHOD, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton } from "./TipStepLayout";
import { FIELD_LABEL_WEIGHT } from "./TipSelect";
import { ErrorLine, PayStepFrame, type TipPayStepProps } from "./TipPayFrame";
import { TipWalletForm } from "./TipWalletForm";
import type { Tx } from "@/lib/i18n/ui";

import { useOptionalTx } from "@/lib/i18n/language-context";
import { stripeLocale } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
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
  if (method === TIP_CRYPTO_PLACEHOLDER) return <CryptoPlaceholder {...props} />;
  if (method === "card") return <CardForm {...props} />;
  if (method === "apple_pay" || method === "google_pay") return <TipWalletForm {...props} />;
  if (method === TIP_FALLBACK_METHOD) return <FallbackForm {...props} />;
  return <SingleMethodForm {...props} />;
}

/** Shared submit state + result handling for the per-method forms. */
function useTipConfirm(tx: Tx, onConfirmed: (outcome: TipConfirmOutcome) => void, patron?: TipPayStepProps["patron"]) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not the `busy` state: two quick clicks land before React re-renders, and a second
  // confirm on the same intent fails and flashes an error.
  const inFlight = useRef(false);
  /** Resolves true when the tip went through. */
  const run = async (confirm: () => Promise<PaymentIntentResult>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    let read: ReturnType<typeof readConfirmResult>;
    try {
      if (patron && !(await patron.beforeConfirm())) {
        setError(tx("Nie udało się zapisać Twojej zgody. Spróbuj ponownie.", "We could not save your consent. Please try again."));
        return false;
      }
      read = readConfirmResult(await confirm(), tx, Boolean(patron));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    if ("outcome" in read) {
      onConfirmed(read.outcome);
      return true;
    }
    setError(read.error);
    return false;
  };
  return { busy, error, run };
}

function SendButton({
  busy,
  disabled,
  label,
  busyLabel,
  tx,
  onClick,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  busyLabel?: string;
  tx: Tx;
  onClick: () => void;
}) {
  return (
    <TipPrimaryButton onClick={onClick} disabled={disabled || busy} busy={busy}>
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {busyLabel ?? (tx("Wysyłam…", "Sending…"))}
        </>
      ) : (
        label
      )}
    </TipPrimaryButton>
  );
}


function toMinor(amount: number) {
  return Math.round(amount * 100);
}

function sendLabel(tx: Tx, amount: number, currency: SupportedCurrency, language: Locale, patron = false) {
  const formatted = formatTipAmount(amount, currency, language);
  return patron ? tx("Zapłać {0}", "Pay {0}", formatted) : tx("Wyślij {0}", "Send {0}", formatted);
}

function BlikForm(props: TipPayStepProps) {
  const { language, amount, currency, clientSecret, userEmail, onConfirmed } = props;
  const tx = useOptionalTx(language);
  const stripe = useStripe();
  const [code, setCode] = useState("");
  const { busy, error, run } = useTipConfirm(tx, onConfirmed, props.patron);
  const valid = /^\d{6}$/.test(code);
  const blocked = props.patron ? !props.patron.accepted : false;

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton
          busy={busy}
          disabled={!valid || !stripe || blocked}
          tx={tx}
          label={sendLabel(tx, amount, currency, language, Boolean(props.patron))}
          // Stripe.js waits here (up to 60 s) until the payment is approved in the banking app.
          busyLabel={tx("Potwierdź w aplikacji banku…", "Approve in your banking app…")}
          onClick={async () => {
            if (!stripe) return;
            const sent = await run(() =>
              stripe.confirmBlikPayment(clientSecret, {
                payment_method: { blik: {}, ...(userEmail ? { billing_details: { email: userEmail } } : {}) },
                payment_method_options: { blik: { code } },
              }),
            );
            // A BLIK code works once; a failed attempt needs a fresh one.
            if (!sent) setCode("");
          }}
        />
      }
    >
      <label className="block">
        <span className={`mb-2 block text-[13px] leading-[1.55] ${FIELD_LABEL_WEIGHT} text-[var(--chan-body)]`}>
          {tx("Kod BLIK z aplikacji banku", "BLIK code from your banking app")}
        </span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-label={tx("Kod BLIK", "BLIK code")}
          className="h-16 w-full rounded-[14px] border-2 border-[var(--cm-amber-38)] bg-white text-center text-[28px] font-extrabold tracking-[0.35em] tabular-nums text-[var(--chan-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--cm-amber-46)] focus:border-[var(--chan-ink)] focus:shadow-[0_0_0_4px_var(--cm-amber-18)]"
        />
      </label>
      <p className="mt-2 text-[12px] text-[var(--chan-muted)]">
        {props.patron
          ? tx("Po zapłacie masz 60 sekund na potwierdzenie w aplikacji banku.", "After you pay, you have 60 seconds to confirm in your banking app.")
          : tx("Po wysłaniu masz 60 sekund na potwierdzenie napiwku w aplikacji banku.", "After sending, you have 60 seconds to confirm the tip in your banking app.")}
      </p>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

function RedirectForm(props: TipPayStepProps) {
  const { language, clientSecret, paymentId, userEmail, onConfirmed } = props;
  const tx = useOptionalTx(language);
  const stripe = useStripe();
  const { busy, error, run } = useTipConfirm(tx, onConfirmed, props.patron);

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton
          busy={busy}
          disabled={!stripe || !userEmail || (props.patron ? !props.patron.accepted : false)}
          tx={tx}
          label={tx("Przejdź do Przelewy24", "Continue to Przelewy24")}
          onClick={() =>
            stripe &&
            userEmail &&
            run(() =>
              stripe.confirmP24Payment(clientSecret, {
                payment_method: { billing_details: { email: userEmail } },
                return_url: props.patron?.returnUrl ?? buildTipReturnUrl(paymentId),
              }),
            )
          }
        />
      }
    >
      <p className="text-[14px] leading-[1.6] text-[var(--chan-body)]">
        {tx("Przeniesiemy Cię do Przelewy24, gdzie wybierzesz swój bank. Po zapłacie wrócisz tutaj.", "You'll go to Przelewy24 to pick your bank, then come right back here.")}
      </p>
      {!userEmail && (
        <ErrorLine
          error={
            tx("Przelewy24 wymaga adresu e-mail na koncie. Dodaj go w ustawieniach konta albo wybierz inną metodę.", "Przelewy24 needs an email address on your account. Add one in your account settings or choose another method.")
          }
        />
      )}
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

function CardForm(props: TipPayStepProps) {
  // The card field needs its own Elements group: Elements bound to a PaymentIntent secret
  // are reserved for the Payment/Express Checkout Elements.
  return (
    <Elements stripe={props.stripePromise} options={{ locale: stripeLocale(props.language) }}>
      <CardFormInner {...props} />
    </Elements>
  );
}

function CardFormInner(props: TipPayStepProps) {
  const { language, amount, currency, clientSecret, userEmail, onConfirmed } = props;
  const tx = useOptionalTx(language);
  const stripe = useStripe();
  const elements = useElements();
  const [complete, setComplete] = useState(false);
  const { busy, error, run } = useTipConfirm(tx, onConfirmed, props.patron);

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
        <SendButton busy={busy} disabled={!complete || !stripe || (props.patron ? !props.patron.accepted : false)} tx={tx} label={sendLabel(tx, amount, currency, language, Boolean(props.patron))} onClick={send} />
      }
    >
      <div className="rounded-[14px] border-2 border-[var(--cm-amber-38)] bg-white px-4 py-4 transition-[border-color,box-shadow] focus-within:border-[var(--chan-ink)] focus-within:shadow-[0_0_0_4px_var(--cm-amber-18)]">
        <CardElement
          onChange={(event) => setComplete(event.complete)}
          options={{
            hidePostalCode: true,
            style: { base: { fontSize: "16px", color: "#1a1a1a", "::placeholder": { color: "#5d6679" } } },
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
  const tx = useOptionalTx(language);
  const stripe = useStripe();
  const elements = useElements();
  const { busy, error, run } = useTipConfirm(tx, onConfirmed, props.patron);

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
          return_url: props.patron?.returnUrl ?? buildTipReturnUrl(paymentId),
          ...(userEmail ? { payment_method_data: { billing_details: { email: userEmail } } } : {}),
        },
        redirect: "if_required",
      });
    });

  return (
    <PayStepFrame
      props={props}
      footer={
        <SendButton busy={busy} disabled={!stripe || !elements || (props.patron ? !props.patron.accepted : false)} tx={tx} label={sendLabel(tx, amount, currency, language, Boolean(props.patron))} onClick={send} />
      }
    >
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false },
          business: { name: APP_NAME },
          wallets: { applePay: "never", googlePay: "never", link: "never" },
          fields: { billingDetails: { email: userEmail ? "never" : "auto" } },
        }}
      />
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
        // The intent uses automatic payment methods, so narrow with allowedPaymentMethodTypes;
        // paymentMethodTypes would declare manual methods and not match the intent.
        allowedPaymentMethodTypes: [method],
        locale: stripeLocale(language),
      }}
    >
      <FallbackForm {...props} deferred />
    </Elements>
  );
}

/** Placeholder until crypto tips exist: explains and sends the viewer back to pick another method. */
function CryptoPlaceholder(props: TipPayStepProps) {
  const tx = useOptionalTx(props.language);
  return (
    <PayStepFrame
      props={props}
      footer={<TipPrimaryButton onClick={props.onChangeMethod}>{tx("Wybierz inną metodę", "Choose another method")}</TipPrimaryButton>}
    >
      <p className="text-[14px] leading-[1.6] text-[var(--chan-body)]">
        {tx("Napiwki w kryptowalutach będą dostępne już wkrótce. Na razie wybierz inną metodę.", "Crypto tips are coming soon. For now, please choose another method.")}
      </p>
    </PayStepFrame>
  );
}
