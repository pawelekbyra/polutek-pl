"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.3): payment methods are choice tiles only.
// No method ever opens an input: there is no card number, expiry, CVC, BLIK code or bank login field anywhere.
import React, { useEffect, useState } from "react";
import type { Tx } from "@/lib/i18n/ui";
import type { PassMethod } from "@/lib/modules/experiment-premium-pass/domain/pass-state";
import { methodLabel } from "./pass-copy";
import styles from "./premium-pass.module.css";

const MARKS: Record<PassMethod, string> = {
  blik: "BLIK",
  card: "VISA · MC",
  apple_pay: "Pay",
  google_pay: "G Pay",
  p24: "P24",
};

/** BLIK first (the most used method in Poland), Apple Pay / Google Pay only where the browser offers them. */
export function usePassMethods(): PassMethod[] {
  const [methods, setMethods] = useState<PassMethod[]>(["blik", "card", "p24"]);
  useEffect(() => {
    const w = window as unknown as { ApplePaySession?: unknown };
    const ua = navigator.userAgent;
    const chromium = /Chrome|CriOS|Android/.test(ua) && !/Edg\//.test(ua);
    setMethods(["blik", "card", ...(w.ApplePaySession ? (["apple_pay"] as const) : []), ...(chromium ? (["google_pay"] as const) : []), "p24"]);
  }, []);
  return methods;
}

export function PassMethodPicker({ tx, methods, value, onChange, labelId }: { tx: Tx; methods: PassMethod[]; value: PassMethod; onChange: (m: PassMethod) => void; labelId: string }) {
  return (
    <div>
      <p className={styles.label} id={labelId}>{tx("Metoda płatności", "Payment method")}</p>
      <div role="radiogroup" aria-labelledby={labelId} className={styles.methods}>
        {methods.map((method) => (
          <label key={method} className={styles.method}>
            <input type="radio" name="pass-method" value={method} checked={value === method} onChange={() => onChange(method)} />
            {MARKS[method] !== methodLabel(tx, method) && <span className={styles.methodMark} aria-hidden="true">{MARKS[method]}</span>}
            {methodLabel(tx, method)}
          </label>
        ))}
      </div>
      <p className={styles.muted} style={{ marginTop: 6 }}>{tx("Demo: bez pól do wpisania, wybór metody wystarczy.", "Demo: nothing to type in, choosing a method is enough.")}</p>
    </div>
  );
}
