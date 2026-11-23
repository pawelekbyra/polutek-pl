"use client";

import React from "react";
import { AlertCircle, Clock, Undo2 } from "lucide-react";
import { Loader2 } from "../icons";
import { CheckIcon } from "../premium-pass/PassIcons";
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

/** The disc behind each outcome's icon: green for the thank-you (as the checkout's tick), blue-grey for waiting, red for a failure. */
const DISC: Record<Outcome, string> = {
  thanks: "bg-[color-mix(in_srgb,var(--pass-ok)_14%,transparent)] text-[var(--pass-ok)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--pass-ok)_6%,transparent)]",
  pending: "bg-[var(--pass-tint)] text-[var(--pass-accent)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--pass-accent)_6%,transparent)]",
  timeout: "bg-[var(--pass-tint)] text-[var(--pass-accent)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--pass-accent)_6%,transparent)]",
  refunded: "bg-[var(--pass-tint)] text-[var(--pass-accent)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--pass-accent)_6%,transparent)]",
  failed: "bg-[color-mix(in_srgb,var(--pass-err)_12%,transparent)] text-[var(--pass-err)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--pass-err)_5%,transparent)]",
};

const SECONDARY_BUTTON =
  "h-[var(--pass-btn-h,48px)] rounded-[12px] border-2 border-[var(--pass-edge)] bg-[var(--chan-card)] text-[14px] font-semibold text-[var(--chan-ink)] hover:border-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pass-accent)] disabled:opacity-60";

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
      icon: <CheckIcon className="h-9 w-9" />,
      title: tx("Dziękuję!", "Thank you!"),
      body: tx("Napiwek dotarł. Bez wsparcia widzów tego projektu by nie było.", "Your tip arrived. This project wouldn't exist without viewers' support."),
    },
    pending: {
      icon: <Loader2 className="h-9 w-9 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
      title: tx("Chwileczkę…", "One moment…"),
      body: tx("Potwierdzam Twój napiwek. To zajmie tylko chwilę.", "Confirming your tip. This only takes a moment."),
    },
    timeout: {
      icon: <Clock className="h-9 w-9" strokeWidth={1.8} aria-hidden="true" />,
      title: tx("Trwa to dłużej niż zwykle", "This is taking longer than usual"),
      body: tx("Sprawdź status za chwilę — nie musisz płacić ponownie.", "Check the status again in a moment — no need to pay twice."),
    },
    refunded: {
      icon: <Undo2 className="h-9 w-9" strokeWidth={1.8} aria-hidden="true" />,
      title: tx("Napiwek został zwrócony", "This tip was refunded"),
      body: tx("Ta wpłata została zwrócona albo jest sporna. Szczegóły znajdziesz w potwierdzeniu z banku.", "This payment was refunded or is disputed. Your bank statement has the details."),
    },
    failed: {
      icon: <AlertCircle className="h-9 w-9" strokeWidth={1.8} aria-hidden="true" />,
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
            <button type="button" onClick={onRetryStatusCheck} disabled={isSyncing} className={SECONDARY_BUTTON}>
              {tx("Sprawdź ponownie", "Check again")}
            </button>
          )}
          {outcome === "failed" && (
            <button type="button" onClick={onTryAgain} className={SECONDARY_BUTTON}>
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
        <span aria-hidden="true" className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${DISC[outcome]}`}>
          {icon}
        </span>
        <h3 data-step-heading="" tabIndex={-1} className="m-0 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--chan-ink)] outline-none">{title}</h3>
        <p className="mt-3 max-w-[300px] text-[14px] leading-[1.6] text-[var(--chan-body)]">{body}</p>
      </div>
    </TipStepLayout>
  );
}
