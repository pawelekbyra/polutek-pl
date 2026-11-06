"use client";
// patron zone (docs/architecture/patron-zone.md): the seller card of the checkout, between the order summary and the
// legal links (steps 1 and 2) and as a one-line variant in step 3. The seller data lives in PATRON_SELLER (pass-copy.ts).
// The card is passive (not clickable). The shield on its right edge is informative only: a badge, NOT a claim of
// verification (it never says "verified"; its label is true: the payment is secure / test mode) and it shows only while a gateway runs.
import React from "react";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tx } from "@/lib/i18n/ui";
import { PATRON_SELLER } from "./pass-copy";
import { TrustShieldIcon } from "./PassIcons";
import type { PassPayMode } from "./PassTrustRow";
import styles from "./premium-pass.module.css";

export function PassSellerCard({ tx, compact, mode = "demo" }: { tx: Tx; compact?: boolean; mode?: PassPayMode }) {
  const details = [PATRON_SELLER.nip ? tx("NIP: {0}", "Tax ID (NIP): {0}", PATRON_SELLER.nip) : null].filter(Boolean);
  const badgeLabel = mode === "live" ? tx("Bezpieczna płatność", "Secure payment") : tx("Tryb testowy: bez prawdziwej płatności", "Test mode: no real payment");
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
        </div>
        {mode !== "demo" && (
          <span className={styles.sellerBadge} role="img" data-trust-badge="" aria-label={badgeLabel} title={badgeLabel}>
            <TrustShieldIcon />
          </span>
        )}
      </div>
    </section>
  );
}
