"use client";

import React from "react";
import { Loader2 } from "../icons";
import { TipPrimaryButton, TipStepLayout } from "./TipStepLayout";

interface TipThanksStepProps {
  language: string;
  paymentUiStatus: string | null;
  isSyncing: boolean;
  onRetryStatusCheck: () => void;
  onTryAgain: () => void;
  onDone: () => void;
}

type Outcome = "thanks" | "pending" | "failed" | "timeout";

function outcomeOf(status: string | null): Outcome {
  if (status === "SUCCEEDED" || status === "ACCESS_SYNC_PENDING") return "thanks";
  if (status === "FAILED_CANCELED" || status === "REFUNDED_DISPUTED") return "failed";
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
  const isPl = language === "pl";
  const outcome = outcomeOf(paymentUiStatus);

  const copy: Record<Outcome, { icon: React.ReactNode; title: string; body: string }> = {
    thanks: {
      icon: "🎉",
      title: isPl ? "Dziękuję!" : "Thank you!",
      body: isPl
        ? "Napiwek dotarł. Bez wsparcia widzów tego projektu by nie było."
        : "Your tip arrived. This project wouldn't exist without viewers' support.",
    },
    pending: {
      icon: <Loader2 className="h-10 w-10 animate-spin text-[var(--chan-muted)] motion-reduce:animate-none" aria-hidden="true" />,
      title: isPl ? "Chwileczkę…" : "One moment…",
      body: isPl ? "Potwierdzam Twój napiwek. To zajmie tylko chwilę." : "Confirming your tip. This only takes a moment.",
    },
    timeout: {
      icon: "⏳",
      title: isPl ? "Trwa to dłużej niż zwykle" : "This is taking longer than usual",
      body: isPl
        ? "Sprawdź status za chwilę — nie musisz płacić ponownie."
        : "Check the status again in a moment — no need to pay twice.",
    },
    failed: {
      icon: "😕",
      title: isPl ? "Coś poszło nie tak" : "Something went wrong",
      body: isPl
        ? "Płatność nie została ukończona. Nic nie zostało pobrane."
        : "The payment was not completed. Nothing was charged.",
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
              className="h-12 rounded-[14px] border-2 border-[var(--chan-line)] text-[14px] font-bold text-[var(--chan-ink)] hover:bg-[var(--chan-surface)] disabled:opacity-60"
            >
              {isPl ? "Sprawdź ponownie" : "Check again"}
            </button>
          )}
          {outcome === "failed" && (
            <button
              type="button"
              onClick={onTryAgain}
              className="h-12 rounded-[14px] border-2 border-[var(--chan-line)] text-[14px] font-bold text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]"
            >
              {isPl ? "Spróbuj jeszcze raz" : "Try again"}
            </button>
          )}
          <TipPrimaryButton onClick={onDone}>{isPl ? "Wróć do filmu" : "Back to the video"}</TipPrimaryButton>
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
