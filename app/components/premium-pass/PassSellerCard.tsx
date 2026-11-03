"use client";
// patron zone (docs/architecture/patron-zone.md): the seller card of the checkout, between the order summary and the
// legal links (steps 1 and 2) and as a one-line variant in step 3. The seller data lives in PATRON_SELLER (pass-copy.ts);
// the (i) button opens a short extra paragraph (height animated with the grid-rows trick, no motion when reduced).
import React, { useId, useState } from "react";
import { Info, Store } from "lucide-react";
import { ShieldCheck } from "../icons";
import { cn } from "@/lib/utils";
import type { Tx } from "@/lib/i18n/ui";
import { PATRON_SELLER } from "./pass-copy";
import type { PassPayMode } from "./PassTrustRow";
import styles from "./premium-pass.module.css";

export function PassSellerCard({ tx, compact, mode = "demo" }: { tx: Tx; compact?: boolean; mode?: PassPayMode }) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const details = [PATRON_SELLER.nip ? tx("NIP: {0}", "Tax ID (NIP): {0}", PATRON_SELLER.nip) : null].filter(Boolean);
  return (
    <section className={cn(styles.sellerCard, compact && styles.sellerCardCompact)} aria-label={tx("Sprzedawca", "Seller")} data-seller-card="">
      <div className={styles.sellerCardRow}>
        <span className={styles.sellerCardIconBox} aria-hidden="true"><Store size={compact ? 15 : 17} strokeWidth={1.8} focusable="false" /></span>
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
          {/* NOT "verified seller": no independent party has verified the seller. The true statement is who processes the payment (Stripe); in test mode it says so. */}
          {!compact && mode !== "demo" && (
            <span className={styles.sellerStripe} data-stripe-badge="">
              <ShieldCheck size={14} aria-hidden="true" focusable="false" />
              {mode === "live" ? tx("Płatność przetwarza Stripe", "Payment processed by Stripe") : tx("Stripe (tryb testowy)", "Stripe (test mode)")}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.sellerCardInfo}
          aria-label={tx("Informacje o sprzedawcy", "Seller information")}
          aria-expanded={open}
          aria-controls={noteId}
          onClick={() => setOpen((value) => !value)}
        >
          <Info size={18} strokeWidth={1.8} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div className={cn(styles.sellerCardNote, open && styles.sellerCardNoteOpen)} id={noteId}>
        <div>
          <p>{tx("Zakupu dokonujesz od sprzedawcy wskazanego powyżej. Dane do faktury i kontakt znajdziesz w Regulaminie.", "You are buying from the seller named above. Invoice details and contact are in the Terms.")}</p>
        </div>
      </div>
    </section>
  );
}
