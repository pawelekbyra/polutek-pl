"use client";

import React, { useState } from "react";
import { Check } from "../icons";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TipLegalDialog, type TipLegalDoc } from "./TipLegalDialog";
import { TipPrimaryButton, TipStepHeading, TipStepLayout } from "./TipStepLayout";

import { useOptionalTx } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/routing";
import { txRich } from "@/lib/i18n/rich";
interface TipRecipientStepProps {
  language: Locale;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  /** Proceeds to the amount step. */
  onNext: () => void;
  /** "Nikomu" selected — close the gate immediately. */
  onClose: () => void;
}

export function TipRecipientStep({
  language,
  termsAccepted,
  onTermsChange,
  onNext,
  onClose,
}: TipRecipientStepProps) {
  const tx = useOptionalTx(language);
  const [attempted, setAttempted] = useState(false);
  const showTermsError = attempted && !termsAccepted;
  const [legalDoc, setLegalDoc] = useState<TipLegalDoc | null>(null);

  const legalLink = (key: TipLegalDoc, label: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setLegalDoc(key);
      }}
      className="font-semibold text-[var(--chan-ink)] underline underline-offset-2 hover:text-[var(--chan-ink)]"
    >
      {label}
    </button>
  );

  const handleNext = () => {
    setAttempted(true);
    if (!termsAccepted) return;
    onNext();
  };

  return (
    <TipStepLayout
      bodyClassName="flex flex-col pb-0"
      footer={
        <>
          <label className="mb-3 flex cursor-pointer items-start gap-2.5">
            <Checkbox
              id="tip-accept-terms-recipient"
              checked={termsAccepted}
              onCheckedChange={(checked) => onTermsChange(checked === true)}
              className="mt-[2px] shrink-0 border-[var(--cm-amber-46)] bg-white data-checked:border-[var(--chan-ink)] data-checked:bg-[var(--chan-ink)] data-checked:text-white"
            />
            <span className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
              {txRich(
                tx,
                "Akceptuję {0} i {1}",
                "I accept the {0} and the {1}",
                legalLink("terms", tx("Regulamin", "Terms")),
                legalLink("privacy", tx("Politykę Prywatności", "Privacy Policy")),
              )}
            </span>
          </label>
          <TipPrimaryButton onClick={handleNext}>
            {tx("Dalej", "Next")}
          </TipPrimaryButton>
        </>
      }
    >
      <TipStepHeading
        title={tx("Odbiorca napiwku", "Tip recipient")}
        subtitle={tx("Komu chciałbyś przekazać napiwek?", "Who would you like to tip?")}
      />

      <div className="flex flex-col gap-2">
        {/* Primary option — Paweł Perfect: visually selected, clicking Dalej proceeds */}
        <div className="rounded-[16px] border-2 border-[var(--chan-ink)] bg-[var(--chan-amber-soft)] px-4 py-3 shadow-[0_6px_18px_-10px_var(--cm-amber-62)]">
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--chan-ink)] bg-[var(--chan-ink)]">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
            <span className="text-[15px] font-extrabold text-[var(--chan-ink)]">{tx("Pawłowi Perfectowi", "Paweł Perfect")}</span>
          </div>
        </div>

        {/* Secondary option — Nobody: clicking immediately closes the gate */}
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
              {tx("Nikomu", "Nobody")}
            </span>
          </div>
        </button>
      </div>

      <p
        role="alert"
        className={`mt-auto pt-3 px-2 text-center text-[12px] font-semibold text-destructive transition-opacity duration-150 ${showTermsError ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {tx("Zaakceptuj Regulamin i Politykę Prywatności.", "Please accept the Terms and Privacy Policy.")}
      </p>

      <TipLegalDialog doc={legalDoc} language={language} onClose={() => setLegalDoc(null)} />
    </TipStepLayout>
  );
}
