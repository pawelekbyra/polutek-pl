import React from "react";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { txRich } from "@/lib/i18n/rich";

import { useOptionalTx } from "@/lib/i18n/language-context";
/**
 * Link to the Terms or the Privacy Policy in the reader's language, opened in a new tab so a form
 * or dialog the reader is filling in stays as it is.
 */
export function LegalDocLink({
  doc,
  language,
  children,
}: {
  doc: "terms" | "privacy";
  language: Locale;
  children: React.ReactNode;
}) {
  return (
    <a
      href={getLocalizedHref(language, doc)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline underline-offset-2 hover:text-[var(--chan-ink)]"
    >
      {children}
    </a>
  );
}

/** "Creating an account (also with Google) accepts the Terms and the Privacy Policy" line shown under every way to sign up. */
export function SignUpLegalNotice({ language }: { language: Locale }) {
  const tx = useOptionalTx(language);
  return (
    <p data-testid="signup-legal-notice" className="text-center text-[11.5px] leading-relaxed text-[var(--chan-muted)]">
      {tx("Zakładając konto (także przez Google), akceptujesz:", "By creating an account (also with Google), you accept:")}
      <span className="block">
        {txRich(
          tx,
          "{0} i {1}.",
          "the {0} and the {1}.",
          <LegalDocLink doc="terms" language={language}>{tx("Regulamin", "Terms")}</LegalDocLink>,
          <LegalDocLink doc="privacy" language={language}>{tx("Politykę prywatności", "Privacy Policy")}</LegalDocLink>,
        )}
      </span>
    </p>
  );
}
