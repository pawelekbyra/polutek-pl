"use client";

import React from "react";
import { TipQuietLink, TipSelectedRow } from "./TipGateParts";
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
      bodyClassName="flex flex-col gap-[var(--pass-gap)] pt-[var(--pass-title-gap)]"
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

      {/* Confirm — pre-selected, Dalej button proceeds */}
      <TipSelectedRow>{tx("Rozumiem, spoko.", "Got it, sure.")}</TipSelectedRow>

      {/* Decline — closes the gate immediately */}
      <TipQuietLink onClick={onClose}>{tx("E, to nie...", "Eh, never mind...")}</TipQuietLink>
    </TipStepLayout>
  );
}
