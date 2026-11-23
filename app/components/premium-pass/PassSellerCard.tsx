"use client";
// patron zone (docs/architecture/patron-zone.md): the seller card of the checkout, between the order summary and the
// legal links (steps 1 and 2) and as a one-line variant in step 3. The seller data lives in PATRON_SELLER (pass-copy.ts).
// The card is passive (not clickable). The shield on its right edge is informative only: a badge, NOT a claim of
// verification (it never says "verified"; its label is true: the payment is secure / test mode) and it shows only while a gateway runs.
// The markup is the shared PassPartyCard (the tip gateway draws its recipient with the same card).
import React from "react";
import { Store } from "lucide-react";
import type { Tx } from "@/lib/i18n/ui";
import { PATRON_SELLER } from "./pass-copy";
import { PassPartyCard } from "./PassPartyCard";
import type { PassPayMode } from "./PassTrustRow";

export function PassSellerCard({ tx, compact, mode = "demo" }: { tx: Tx; compact?: boolean; mode?: PassPayMode }) {
  const details = [PATRON_SELLER.nip ? tx("NIP: {0}", "Tax ID (NIP): {0}", PATRON_SELLER.nip) : null].filter((line): line is string => Boolean(line));
  const badgeLabel = mode === "live" ? tx("Bezpieczna płatność", "Secure payment") : tx("Tryb testowy: bez prawdziwej płatności", "Test mode: no real payment");
  return (
    <PassPartyCard
      label={tx("Sprzedawca", "Seller")}
      name={PATRON_SELLER.name}
      details={details}
      icon={(size) => <Store size={size} strokeWidth={1.8} focusable="false" />}
      compact={compact}
      compactText={tx("Sprzedawca: {0}", "Seller: {0}", PATRON_SELLER.name)}
      badgeLabel={mode !== "demo" ? badgeLabel : null}
      attrs={{ "data-seller-card": "" }}
    />
  );
}
