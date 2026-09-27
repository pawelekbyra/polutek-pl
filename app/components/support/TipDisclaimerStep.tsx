"use client";

import React from "react";
import { Check } from "../icons";
import { cn } from "@/lib/utils";
import { TipStepHeading, TipStepLayout } from "./TipStepLayout";

interface TipDisclaimerStepProps {
  language: string;
  /** Proceeds to the amount step. */
  onNext: () => void;
  /** "E, to nie..." selected — close the gate immediately. */
  onClose: () => void;
}

export function TipDisclaimerStep({ language, onNext, onClose }: TipDisclaimerStepProps) {
  const isPl = language === "pl";

  return (
    <TipStepLayout footer={null}>
      <TipStepHeading
        title={isPl ? "Napiwek" : "Tip"}
        subtitle={
          isPl
            ? "Napiwek jest dobrowolny i niczego nie odblokowuje."
            : "A tip is voluntary and unlocks nothing."
        }
      />

      <div className="flex flex-col gap-3">
        {/* Confirm — proceeds to amount */}
        <button
          type="button"
          onClick={onNext}
          className={cn(
            "rounded-[16px] border-2 border-[var(--cm-amber-28)] bg-transparent px-4 py-4 text-left",
            "transition-[border-color,background-color] duration-150",
            "hover:border-[var(--chan-ink)] hover:bg-[var(--chan-amber-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--cm-amber-38)]" />
            <span className="text-[15px] font-semibold text-[var(--chan-body)]">
              {isPl ? "Rozumiem, spoko." : "Got it, sure."}
            </span>
          </div>
        </button>

        {/* Decline — closes modal immediately */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "rounded-[16px] border-2 border-[var(--cm-amber-28)] bg-transparent px-4 py-4 text-left",
            "transition-[border-color,background-color] duration-150",
            "hover:border-[var(--chan-ink)] hover:bg-[var(--chan-amber-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--cm-amber-38)]" />
            <span className="text-[15px] font-semibold text-[var(--chan-body)]">
              {isPl ? "E, to nie..." : "Eh, never mind..."}
            </span>
          </div>
        </button>
      </div>
    </TipStepLayout>
  );
}
