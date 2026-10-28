"use client";
// Legal sheet (docs/architecture/patron-zone.md, "Dokumenty prawne w kasie"): the context and the link half of the
// legal sheet, split from the sheet itself so the lazily loaded document body can use the link without an import cycle.
import React, { createContext, useContext } from "react";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";

/** The documents the sheet can show. The values are also the route keys of their standalone pages. */
export type LegalSheetDoc = "terms" | "privacy" | "passTerms";

export interface LegalSheetApi {
  /** Opens (or, when already open, switches) the sheet; `opener` is the element focus returns to when it closes. */
  open: (doc: LegalSheetDoc, opener?: HTMLElement | null) => void;
}

export const LegalSheetContext = createContext<LegalSheetApi | null>(null);

/** `null` outside a LegalSheetProvider (the links then stay plain links to the document pages). */
export function useLegalSheet(): LegalSheetApi | null {
  return useContext(LegalSheetContext);
}

/**
 * A link to a legal document page that opens the document in the legal sheet on top of the current dialog. It is a real
 * link first (real `href`, new tab): without JavaScript, outside a provider, and with a modified click (Ctrl/Cmd/Shift,
 * middle button) it behaves exactly as before; only a plain click is taken over, and the dialog under the sheet is untouched.
 */
export function LegalLink({
  doc,
  language,
  className,
  children,
}: {
  doc: LegalSheetDoc;
  language: Locale;
  className?: string;
  children: React.ReactNode;
}) {
  const sheet = useLegalSheet();
  return (
    <a
      href={getLocalizedHref(language, doc)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-haspopup={sheet ? "dialog" : undefined}
      onClick={(event) => {
        if (!sheet || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        sheet.open(doc, event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}
