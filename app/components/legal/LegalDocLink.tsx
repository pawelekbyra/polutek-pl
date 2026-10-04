import React from "react";
import { getLocalizedHref } from "@/lib/i18n/routing";

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
  language: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={getLocalizedHref(language === "pl" ? "pl" : "en", doc)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline underline-offset-2 hover:text-[var(--chan-ink)]"
    >
      {children}
    </a>
  );
}

/** "Creating an account (also with Google) accepts the Terms and the Privacy Policy" line shown under every way to sign up. */
export function SignUpLegalNotice({ language }: { language: string }) {
  const isPl = language === "pl";
  return (
    <p data-testid="signup-legal-notice" className="text-center text-[11.5px] leading-relaxed text-[var(--chan-muted)]">
      {isPl ? (
        <>
          Zakładając konto (także przez Google), akceptujesz:
          <span className="block">
            <LegalDocLink doc="terms" language={language}>Regulamin</LegalDocLink> i{" "}
            <LegalDocLink doc="privacy" language={language}>Politykę prywatności</LegalDocLink>.
          </span>
        </>
      ) : (
        <>
          By creating an account (also with Google), you accept:
          <span className="block">
            the <LegalDocLink doc="terms" language={language}>Terms</LegalDocLink> and the{" "}
            <LegalDocLink doc="privacy" language={language}>Privacy Policy</LegalDocLink>.
          </span>
        </>
      )}
    </p>
  );
}
