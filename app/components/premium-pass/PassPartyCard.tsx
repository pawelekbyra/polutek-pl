"use client";
// The one card of the checkout that names the other side of the payment: the seller in the premium checkout
// (PassSellerCard) and the tip recipient in the tip gateway (TipRecipientCard). Passive (not clickable); the shield on
// its right edge is informative only (a badge, NOT a claim of verification) and shows only while a gateway runs.
import React from "react";
import { cn } from "@/lib/utils";
import { TrustShieldIcon } from "./PassIcons";
import styles from "./premium-pass.module.css";

export interface PassPartyCardProps {
  /** Visible label ("Sprzedawca", "Odbiorca napiwku") and the accessible name of the card. */
  label: string;
  name: string;
  /** Extra lines under the name (e.g. the tax id). */
  details?: string[];
  /** The icon in the grey box; gets the pixel size for the variant. */
  icon: (size: number) => React.ReactNode;
  compact?: boolean;
  /** Label of the shield; null draws no shield. */
  badgeLabel: string | null;
  /** The one text line of the compact variant; defaults to "label: name". */
  compactText?: string;
  /** Extra attributes of the section (data hooks). */
  attrs?: Record<`data-${string}`, string>;
}

export function PassPartyCard({ label, name, details = [], icon, compact, badgeLabel, compactText, attrs }: PassPartyCardProps) {
  return (
    <section className={cn(styles.sellerCard, compact && styles.sellerCardCompact)} aria-label={label} {...attrs}>
      <div className={styles.sellerCardRow}>
        <span className={styles.sellerCardIconBox} aria-hidden="true">{icon(compact ? 15 : 17)}</span>
        <div className={styles.sellerCardText}>
          {compact ? (
            <b>{compactText ?? `${label}: ${name}`}</b>
          ) : (
            <>
              <span className={styles.sellerLabel}>{label}:</span>
              <b>{name}</b>
            </>
          )}
          {details.length > 0 && <span>{details.join(", ")}</span>}
        </div>
        {badgeLabel && (
          <span className={styles.sellerBadge} role="img" data-trust-badge="" aria-label={badgeLabel} title={badgeLabel}>
            <TrustShieldIcon />
          </span>
        )}
      </div>
    </section>
  );
}
