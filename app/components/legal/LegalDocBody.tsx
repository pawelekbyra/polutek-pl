"use client";
// Legal sheet: the body of a legal document, loaded lazily (React.lazy in LegalSheet) so the long texts stay out of the
// checkout's own chunk. The texts are the existing components, unchanged: Terms and Privacy Policy from LegalDocs.tsx
// (Polish and English, other languages read the English one), the Patron Zone Terms draft from PassTermsContent.
import React from "react";
import type { Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { PassTermsContent } from "../premium-pass/PassTermsContent";
import { LEGAL_EFFECTIVE_DATE, LEGAL_EFFECTIVE_DATE_EN, PolitykaContent, PrivacyContentEn, RegulaminContent, TermsContentEn } from "./LegalDocs";
import { LegalLink, type LegalSheetDoc } from "./legal-sheet-context";

export default function LegalDocBody({ doc, tx, language, demo }: { doc: LegalSheetDoc; tx: Tx; language: Locale; demo: boolean }) {
  if (doc === "passTerms") {
    return (
      <PassTermsContent
        tx={tx}
        locale={language}
        demo={demo}
        termsLink={<LegalLink doc="terms" language={language} className="font-bold underline">{tx("Regulamin serwisu", "Terms of service")}</LegalLink>}
      />
    );
  }
  const polish = language === "pl";
  return (
    <>
      <p className="mb-4 text-[12px] text-[var(--chan-muted)]">{polish ? LEGAL_EFFECTIVE_DATE : LEGAL_EFFECTIVE_DATE_EN}</p>
      {!polish && language !== "en" && (
        <p className="mb-4 rounded-lg bg-[var(--chan-surface)] px-3 py-2 text-[12px] text-[var(--chan-muted)]">
          {tx("Dokument jest dostępny po polsku i angielsku.", "The document is available in English and Polish.")}
        </p>
      )}
      {doc === "privacy" ? (polish ? <PolitykaContent /> : <PrivacyContentEn />) : polish ? <RegulaminContent /> : <TermsContentEn />}
    </>
  );
}
