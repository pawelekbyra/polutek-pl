"use client";

import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalLink } from "../legal/legal-sheet-context";
import { TipQuietLink, TipRecipientCard } from "./TipGateParts";
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
  /** "Nie teraz" — close the gate immediately. */
  onClose: () => void;
}

/**
 * Step 1: who the tip goes to (the recipient card, drawn like the checkout's seller card) and the one consent the
 * gateway asks for. The documents open in the legal sheet on top of the gateway (LegalLink); the texts are unchanged.
 */
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

  const legalLink = (doc: "terms" | "privacy", label: string) => (
    <LegalLink doc={doc} language={language} className="font-semibold text-[var(--chan-ink)] underline underline-offset-2">
      {label}
    </LegalLink>
  );

  const handleNext = () => {
    setAttempted(true);
    if (!termsAccepted) return;
    onNext();
  };

  return (
    <TipStepLayout
      bodyClassName="flex flex-col gap-[var(--pass-gap)] pt-[var(--pass-title-gap)]"
      footer={
        <>
          <div className="mb-2 flex items-start gap-3 py-1">
            <Checkbox
              id="tip-accept-terms-recipient"
              checked={termsAccepted}
              onCheckedChange={(checked) => onTermsChange(checked === true)}
              aria-describedby={showTermsError ? "tip-terms-error" : undefined}
              className="mt-[1px] size-5 shrink-0 border-2 border-[var(--pass-edge)] bg-white data-checked:border-[var(--pass-cta)] data-checked:bg-[var(--pass-cta)] data-checked:text-white focus-visible:ring-2 focus-visible:ring-[var(--pass-accent)]"
            />
            <label htmlFor="tip-accept-terms-recipient" className="cursor-pointer text-[13px] leading-[1.45] text-[var(--chan-body)]">
              {txRich(
                tx,
                "Akceptuję {0} i {1}",
                "I accept the {0} and the {1}",
                legalLink("terms", tx("Regulamin", "Terms")),
                legalLink("privacy", tx("Politykę Prywatności", "Privacy Policy")),
              )}
            </label>
          </div>
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

      <TipRecipientCard tx={tx} />

      <TipQuietLink onClick={onClose}>{tx("Nie teraz", "Not now")}</TipQuietLink>

      <p
        id="tip-terms-error"
        role="alert"
        className={`mt-auto px-2 text-center text-[13px] font-semibold text-[var(--pass-err)] transition-opacity duration-150 ${showTermsError ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {tx("Zaakceptuj Regulamin i Politykę Prywatności.", "Please accept the Terms and Privacy Policy.")}
      </p>
    </TipStepLayout>
  );
}
