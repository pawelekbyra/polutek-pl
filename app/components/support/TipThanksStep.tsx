"use client";

import React from "react";
import { Loader2 } from "../icons";
import { TipPrimaryButton, TipStepLayout } from "./TipStepLayout";
import type { TipUiStatus } from "@/lib/hooks/useCheckoutFlow";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
interface TipThanksStepProps {
  language: Locale;
  paymentUiStatus: TipUiStatus | null;
  isSyncing: boolean;
  onRetryStatusCheck: () => void;
  onTryAgain: () => void;
  onDone: () => void;
}

type Outcome = "thanks" | "pending" | "failed" | "refunded" | "timeout";

function outcomeOf(status: TipUiStatus | null): Outcome {
  if (status === "SUCCEEDED") return "thanks";
  if (status === "FAILED") return "failed";
  if (status === "REFUNDED") return "refunded";
  if (status === "TIMED_OUT") return "timeout";
  return "pending";
}

export function TipThanksStep({
  language,
  paymentUiStatus,
  isSyncing,
  onRetryStatusCheck,
  onTryAgain,
  onDone,
}: TipThanksStepProps) {
  const tx = useOptionalTx(language);
  const outcome = outcomeOf(paymentUiStatus);

  const copy: Record<Outcome, { icon: React.ReactNode; title: string; body: string }> = {
    thanks: {
      icon: "🎉",
      title: tx("Dziękuję!", "Thank you!"),
      body: tx("Napiwek dotarł. Bez wsparcia widzów tego projektu by nie było.", "Your tip arrived. This project wouldn't exist without viewers' support."),
    },
    pending: {
      icon: <Loader2 className="h-10 w-10 animate-spin text-[var(--chan-muted)] motion-reduce:animate-none" aria-hidden="true" />,
      title: tx("Chwileczkę…", "One moment…"),
      body: tx("Potwierdzam Twój napiwek. To zajmie tylko chwilę.", "Confirming your tip. This only takes a moment."),
    },
    timeout: {
      icon: "⏳",
      title: tx("Trwa to dłużej niż zwykle", "This is taking longer than usual"),
      body: tx("Sprawdź status za chwilę — nie musisz płacić ponownie.", "Check the status again in a moment — no need to pay twice."),
    },
    refunded: {
      icon: "↩️",
      title: tx("Napiwek został zwrócony", "This tip was refunded"),
      body: tx("Ta wpłata została zwrócona albo jest sporna. Szczegóły znajdziesz w potwierdzeniu z banku.", "This payment was refunded or is disputed. Your bank statement has the details."),
    },
    failed: {
      icon: "😕",
      title: tx("Coś poszło nie tak", "Something went wrong"),
      body: tx("Płatność nie została ukończona. Nic nie zostało pobrane.", "The payment was not completed. Nothing was charged."),
    },
  };
  const { icon, title, body } = copy[outcome];

  return (
    <TipStepLayout
      bodyClassName="flex flex-col items-center justify-center text-center"
      footer={
        <div className="flex flex-col gap-2.5">
          {outcome === "timeout" && (
            <button
              type="button"
              onClick={onRetryStatusCheck}
              disabled={isSyncing}
              className="h-12 rounded-[14px] border-2 border-[var(--cm-amber-38)] bg-[var(--chan-amber-soft)] text-[14px] font-bold text-[var(--chan-ink)] hover:bg-[var(--cm-amber-28)] disabled:opacity-60"
            >
              {tx("Sprawdź ponownie", "Check again")}
            </button>
          )}
          {outcome === "failed" && (
            <button
              type="button"
              onClick={onTryAgain}
              className="h-12 rounded-[14px] border-2 border-[var(--cm-amber-38)] bg-[var(--chan-amber-soft)] text-[14px] font-bold text-[var(--chan-ink)] hover:bg-[var(--cm-amber-28)]"
            >
              {tx("Spróbuj jeszcze raz", "Try again")}
            </button>
          )}
          <TipPrimaryButton onClick={onDone}>{tx("Wróć do filmu", "Back to the video")}</TipPrimaryButton>
        </div>
      }
    >
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center animate-in fade-in zoom-in-90 duration-500 motion-reduce:animate-none"
      >
        <span aria-hidden="true" className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--chan-amber-soft)] text-[40px]">
          {icon}
        </span>
        <h2 className="font-brand m-0 text-[28px] font-extrabold leading-tight tracking-[-0.035em] text-[var(--chan-ink)]">{title}</h2>
        <p className="mt-3 max-w-[300px] text-[14px] leading-[1.6] text-[var(--chan-body)]">{body}</p>
      </div>
    </TipStepLayout>
  );
}
