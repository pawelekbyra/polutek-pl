"use client";

import React, { useState } from "react";
import { ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { SupportedCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buildTipReturnUrl, readConfirmResult, type TipConfirmOutcome } from "./tip-confirm";
import { describeTipMethod, formatTipAmount } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipMethodStepProps {
  language: string;
  amount: number;
  currency: SupportedCurrency;
  paymentId: string | null;
  /** Tiles, already filtered/ordered from Stripe's `payment_method_types`. */
  methods: string[];
  selected: string | null;
  onSelect: (method: string) => void;
  onNext: () => void;
  onChangeAmount: () => void;
  onWalletConfirmed: (outcome: TipConfirmOutcome) => void;
}

/**
 * "Metoda napiwku": Stripe's own Apple Pay / Google Pay button on top (Stripe checks the device
 * and only renders it when a wallet is available; one tap pays), then our tiles for the methods
 * Stripe allows for this intent. Must render inside <Elements> bound to the intent.
 */
export function TipMethodStep({
  language,
  amount,
  currency,
  paymentId,
  methods,
  selected,
  onSelect,
  onNext,
  onChangeAmount,
  onWalletConfirmed,
}: TipMethodStepProps) {
  const isPl = language === "pl";
  const stripe = useStripe();
  const elements = useElements();
  const [walletReady, setWalletReady] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const confirmWallet = async () => {
    if (!stripe || !elements) return;
    setWalletError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: buildTipReturnUrl(paymentId) },
      redirect: "if_required",
    });
    const read = readConfirmResult(result, isPl);
    if ("outcome" in read) onWalletConfirmed(read.outcome);
    else setWalletError(read.error);
  };

  return (
    <TipStepLayout
      footer={
        <TipPrimaryButton onClick={onNext} disabled={!selected}>
          {isPl ? "Dalej" : "Next"}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading title={isPl ? "Metoda napiwku" : "Tip method"} />

      <div className="mb-5 flex items-center justify-between gap-3 rounded-[14px] bg-[var(--chan-amber-soft)] px-4 py-3">
        <p className="m-0 text-[14px] font-bold tabular-nums text-[var(--chan-ink)]">
          {isPl ? "Napiwek" : "Tip"} {formatTipAmount(amount, currency, language)}
        </p>
        <button type="button" onClick={onChangeAmount} className="text-[13px] font-bold text-[var(--chan-blue)] hover:underline">
          {isPl ? "Zmień" : "Change"}
        </button>
      </div>

      <div className={cn(!walletReady && "hidden")}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 52,
            buttonType: { applePay: "donate", googlePay: "donate" },
            paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
          }}
          onReady={({ availablePaymentMethods }) => setWalletReady(Boolean(availablePaymentMethods))}
          onConfirm={confirmWallet}
        />
        {walletError && (
          <p role="alert" className="mt-2 text-center text-[13px] font-medium text-red-600">{walletError}</p>
        )}
        <div className="my-4 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--chan-muted)]" aria-hidden="true">
          <span className="h-px flex-1 bg-[var(--chan-line)]" />
          {isPl ? "albo" : "or"}
          <span className="h-px flex-1 bg-[var(--chan-line)]" />
        </div>
      </div>

      <div role="radiogroup" aria-label={isPl ? "Metoda napiwku" : "Tip method"} className="flex flex-col gap-2.5">
        {methods.map((method) => {
          const copy = describeTipMethod(method, isPl);
          const isSelected = method === selected;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(method)}
              className={cn(
                "flex min-h-[60px] items-center gap-4 rounded-[16px] border-2 px-4 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none",
                isSelected
                  ? "border-[var(--chan-amber)] bg-[var(--chan-amber-soft)]"
                  : "border-[var(--chan-line)] bg-white hover:border-[var(--cm-amber-38)]",
              )}
            >
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[20px]">
                {copy.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-[var(--chan-ink)]">{copy.title}</span>
                <span className="block text-[12px] text-[var(--chan-muted)]">{copy.hint}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  isSelected ? "border-[var(--chan-amber)] bg-[var(--chan-amber)]" : "border-[var(--chan-line)]",
                )}
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
            </button>
          );
        })}
      </div>
    </TipStepLayout>
  );
}
