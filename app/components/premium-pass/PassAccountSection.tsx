"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.6): "My account -> Pass". No "cancel
// subscription" button: there is no subscription.
import React from "react";
import type { Tx } from "@/lib/i18n/ui";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";
import { DemoRibbon } from "./DemoRibbon";
import { PassReceipt } from "./PassSuccess";
import { passDate } from "./pass-copy";
import type { PremiumPassStatus } from "./usePremiumPass";

export function PassAccountSection({ tx, status }: { tx: Tx; status: PremiumPassStatus }) {
  const { language } = useLanguage();
  const { pass } = status;
  return (
    <div className="space-y-3 font-sans text-[14px] text-[var(--chan-ink)]">
      <DemoRibbon />
      <p className="font-bold">
        {pass.state === "none" && tx("Nie masz wejściówki.", "You do not have a pass.")}
        {pass.state === "active" && tx("Wejściówka aktywna do {0}.", "Pass active until {0}.", passDate(language, pass.expiresAt, true))}
        {pass.state === "expired" && tx("Twoja wejściówka wygasła {0}.", "Your pass expired on {0}.", passDate(language, pass.expiresAt))}
      </p>
      {pass.state !== "none" && <PassReceipt tx={tx} language={language} pass={pass} />}
      <p className="text-[13px] text-[var(--chan-muted)]">{tx("Wejściówka nie odnawia się.", "The pass does not renew.")}</p>
      <a
        href={getLocalizedHref(language, "pass")}
        className="inline-flex min-h-11 items-center rounded-[12px] bg-[var(--chan-ink)] px-4 text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2"
      >
        {pass.state === "active" ? tx("Przejdź do filmów Premium", "Go to the Premium videos") : tx("Kup wejściówkę", "Get the pass")}
      </a>
    </div>
  );
}
