"use client";
// patron zone (docs/architecture/patron-zone.md): the trust row under the order summary ("Razem do zapłaty"): a lock and the
// SSL line on the left, the logos of the payment methods that are REALLY offered for the chosen currency on the right.
// Every claim is true: the checkout is served over HTTPS (HSTS), and a payment goes through Stripe. In test mode the line
// talks about the connection only (no "secure payment" while no real payment exists), in demo mode there are no logos.
import React from "react";
import { Lock } from "../icons";
import type { Tx } from "@/lib/i18n/ui";
import styles from "./premium-pass.module.css";

/** How the checkout takes money: no gateway (demo), Stripe test keys, Stripe live keys. */
export type PassPayMode = "demo" | "test" | "live";

type LogoId = "blik" | "visa" | "mastercard";
const LOGO_SIZE: Record<LogoId, { w: number; h: number; name: string }> = {
  blik: { w: 135.639, h: 64.18, name: "BLIK" },
  visa: { w: 750, h: 471, name: "Visa" },
  mastercard: { w: 750, h: 471, name: "Mastercard" },
};
const LOGO_HEIGHT = 15;

/** Logos for the methods in the list: cards -> Visa + Mastercard; BLIK only with the BLIK method AND the zloty. */
export function paymentLogosFor(methods: string[], currency: string): LogoId[] {
  const out: LogoId[] = [];
  if (currency === "PLN" && methods.includes("blik")) out.push("blik");
  if (methods.includes("card")) out.push("visa", "mastercard");
  return out;
}

export function PassTrustRow({ tx, mode, methods, currency }: { tx: Tx; mode: PassPayMode; methods: string[]; currency: string }) {
  const logos = mode === "demo" ? [] : paymentLogosFor(methods, currency);
  const label = mode === "live" ? tx("Bezpieczna płatność SSL", "Secure SSL payment") : tx("Bezpieczne połączenie SSL", "Secure SSL connection");
  return (
    <div className={styles.trustRow} data-trust-row="">
      <span className={styles.trustSsl}>
        <Lock size={15} aria-hidden="true" focusable="false" />
        <span>{label}</span>
      </span>
      {logos.length > 0 && (
        <ul className={styles.trustLogos} aria-label={tx("Akceptowane metody płatności", "Accepted payment methods")}>
          {logos.map((id) => (
            <li key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/payments/${id}.svg`} alt={LOGO_SIZE[id].name} height={LOGO_HEIGHT} width={Math.round((LOGO_SIZE[id].w / LOGO_SIZE[id].h) * LOGO_HEIGHT)} loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
