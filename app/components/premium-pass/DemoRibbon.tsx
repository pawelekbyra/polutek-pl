"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.7): the DEMO strip on every purchase screen.
// It cannot be turned off by configuration.
import React from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import styles from "./premium-pass.module.css";

export function DemoRibbon({ dark = false, paid = false }: { dark?: boolean; paid?: boolean }) {
  const { tx } = useLanguage();
  return (
    <div role="note" data-demo-ribbon="" className={cn(styles.ribbon, dark && styles.ribbonDark)}>
      {paid
        ? tx("Tryb demo · pobrano 0,00 zł", "Demo mode · charged PLN 0.00")
        : tx("Tryb demo · płatność symulowana · nic nie zostanie pobrane", "Demo mode · simulated payment · nothing will be charged")}
    </div>
  );
}
