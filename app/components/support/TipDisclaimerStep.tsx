"use client";

import React from "react";
import { Check } from "../icons";
import { cn } from "@/lib/utils";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
interface TipDisclaimerStepProps {
  language: Locale;
  /** Proceeds to the amount step. */
  onNext: () => void;
  /** "E, to nie..." selected — close the gate immediately. */
  onClose: () => void;
}

export function TipDisclaimerStep({ language, onNext, onClose }: TipDisclaimerStepProps) {
  const tx = useOptionalTx(language);

  return (
    <TipStepLayout
      bodyClassName="flex flex-col pb-0"
      footer={
        <TipPrimaryButton onClick={onNext}>
          {tx("Dalej", "Next")}
        </TipPrimaryButton>
      }
    >
      <TipStepHeading
        title={tx("Napiwek", "Tip")}
        subtitle={
          tx("Napiwek jest dobrowolny i niczego nie odblokowuje.", "A tip is voluntary and unlocks nothing.")
        }
      />

      <div className="flex flex-col gap-2">
        {/* Confirm — pre-selected, Dalej button proceeds */}
        <div className="rounded-[16px] border-2 border-[var(--chan-ink)] bg-[var(--chan-amber-soft)] px-4 py-3 shadow-[0_6px_18px_-10px_var(--cm-amber-62)]">
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--chan-ink)] bg-[var(--chan-ink)]">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
            <span className="text-[15px] font-extrabold text-[var(--chan-ink)]">
              {tx("Rozumiem, spoko.", "Got it, sure.")}
            </span>
          </div>
        </div>

        {/* Decline — closes modal immediately */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "rounded-[16px] border-2 border-[var(--cm-amber-28)] bg-transparent px-4 py-3 text-left",
            "transition-[border-color,background-color] duration-150",
            "hover:border-[var(--chan-ink)] hover:bg-[var(--chan-amber-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--cm-amber-38)]" />
            <span className="text-[15px] font-semibold text-[var(--chan-body)]">
              {tx("E, to nie...", "Eh, never mind...")}
            </span>
          </div>
        </button>
      </div>

    </TipStepLayout>
  );
}
