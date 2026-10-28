"use client";
// patron zone (docs/architecture/patron-zone.md): the seller card of the checkout, between the order summary and the
// legal links (steps 1 and 2) and as a one-line variant in step 3. The seller data lives in PATRON_SELLER (pass-copy.ts);
// the (i) button opens a short extra paragraph (height animated with the grid-rows trick, no motion when reduced).
import React, { useId, useState } from "react";
import { Building2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { LegalLink } from "../legal/legal-sheet-context";
import { PATRON_SELLER } from "./pass-copy";
import styles from "./premium-pass.module.css";

export function PassSellerCard({ tx, language, compact }: { tx: Tx; language: Locale; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const details = [compact ? null : PATRON_SELLER.registryLine(tx), PATRON_SELLER.nip ? tx("NIP: {0}", "Tax ID (NIP): {0}", PATRON_SELLER.nip) : null].filter(Boolean);
  return (
    <section className={cn(styles.sellerCard, compact && styles.sellerCardCompact)} aria-label={tx("Sprzedawca", "Seller")} data-seller-card="">
      <div className={styles.sellerCardRow}>
        <Building2 className={styles.sellerCardIcon} strokeWidth={1.6} aria-hidden="true" focusable="false" />
        <div className={styles.sellerCardText}>
          {compact ? (
            <b>{tx("Sprzedawca: {0}", "Seller: {0}", PATRON_SELLER.name)}</b>
          ) : (
            <>
              <span className={styles.sellerLabel}>{tx("Sprzedawca", "Seller")}:</span>
              <b>{PATRON_SELLER.name}</b>
            </>
          )}
          {details.length > 0 && <span>{details.join(", ")}</span>}
        </div>
        <button
          type="button"
          className={styles.sellerCardInfo}
          aria-label={tx("Informacje o sprzedawcy", "Seller information")}
          aria-expanded={open}
          aria-controls={noteId}
          onClick={() => setOpen((value) => !value)}
        >
          <Info size={20} strokeWidth={1.8} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div className={cn(styles.sellerCardNote, open && styles.sellerCardNoteOpen)} id={noteId}>
        <div>
          <p>{tx("Zakupu dokonujesz od sprzedawcy wskazanego powyżej. Dane do faktury i kontakt znajdziesz w Regulaminie.", "You are buying from the seller named above. Invoice details and contact are in the Terms.")}</p>
          <p><LegalLink doc="passTerms" language={language}>{tx("Regulamin strefy patrona", "Patron Zone Terms")}</LegalLink></p>
        </div>
      </div>
    </section>
  );
}
