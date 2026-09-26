"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatTipAmount, type TipMethodChoice } from "./tip-flow-config";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

export type WalletKind = "apple" | "google" | null;

interface TipMethodStepProps {
  language: string;
  amount: number;
  currency: SupportedCurrency;
  choices: TipMethodChoice[];
  selected: TipMethodChoice | null;
  onSelect: (choice: TipMethodChoice) => void;
  walletKind: WalletKind;
  onNext: () => void;
  busy?: boolean;
}

function methodCopy(choice: TipMethodChoice, isPl: boolean, walletKind: WalletKind) {
  switch (choice) {
    case "blik":
      return { icon: "📱", title: "BLIK", hint: isPl ? "Kod z aplikacji banku" : "Code from your banking app" };
    case "p24":
      return { icon: "🏦", title: "Przelewy24", hint: isPl ? "Szybki przelew z Twojego banku" : "Instant transfer from your bank" };
    case "wallet":
      return {
        icon: "📲",
        title: walletKind === "apple" ? "Apple Pay" : "Google Pay",
        hint: isPl ? "Jedno dotknięcie" : "One tap",
      };
    case "card":
    default:
      return { icon: "💳", title: isPl ? "Karta" : "Card", hint: "Visa, Mastercard…" };
  }
}

export function TipMethodStep({
  language,
  amount,
  currency,
  choices,
  selected,
  onSelect,
  walletKind,
  onNext,
  busy,
}: TipMethodStepProps) {
  const isPl = language === "pl";

  return (
    <TipStepLayout
      footer={
        <TipPrimaryButton onClick={onNext} disabled={!selected || busy} busy={busy}>
          {busy ? (isPl ? "Chwileczkę…" : "One moment…") : isPl ? "Dalej" : "Next"}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading
        title={isPl ? "Jak chcesz przesłać?" : "How would you like to send it?"}
        subtitle={
          isPl
            ? `Napiwek ${formatTipAmount(amount, currency, language)}. Wybierz wygodny sposób.`
            : `A ${formatTipAmount(amount, currency, language)} tip. Pick whatever is easiest.`
        }
      />

      <div role="radiogroup" aria-label={isPl ? "Sposób płatności" : "Payment method"} className="flex flex-col gap-2.5">
        {choices.map((choice) => {
          const copy = methodCopy(choice, isPl, walletKind);
          const isSelected = choice === selected;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(choice)}
              className={cn(
                "flex min-h-[64px] items-center gap-4 rounded-[16px] border-2 px-4 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none",
                isSelected
                  ? "border-[var(--chan-amber)] bg-[var(--chan-amber-soft)]"
                  : "border-[var(--chan-line)] bg-white hover:border-[var(--cm-amber-38)]",
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[20px]"
              >
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
