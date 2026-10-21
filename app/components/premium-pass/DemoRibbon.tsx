"use client";
// patron zone (docs/architecture/patron-zone.md): the DEMO strip on the offer page, the
// terms and the account section while `PREMIUM_PASS_PAYMENTS=demo`. Never inside the checkout modal. With real
// payments (`stripe`) the callers do not render it.
import React from "react";
import { useLanguage } from "../LanguageContext";
import styles from "./premium-pass.module.css";

export function DemoRibbon() {
  const { tx } = useLanguage();
  return (
    <div role="note" data-demo-ribbon="" className={styles.ribbon}>
      {tx("Tryb demo · płatność symulowana · nic nie zostanie pobrane", "Demo mode · simulated payment · nothing will be charged")}
    </div>
  );
}
