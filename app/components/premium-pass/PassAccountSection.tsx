"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.6): "My account -> Patron zone". No "cancel
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
  const { pass, offer } = status;
  return (
    <div className="space-y-3 font-sans text-[14px] text-[var(--chan-ink)]">
      {offer.payments.mode === "demo" && <DemoRibbon />}
      <p className="font-bold">
        {pass.state === "none" && tx("Nie jesteś jeszcze patronem.", "You are not a patron yet.")}
        {pass.state === "active" && tx("Strefa patrona otwarta do {0}.", "Patron zone open until {0}.", passDate(language, pass.expiresAt, true))}
        {pass.state === "expired" && tx("Twój dostęp do strefy patrona wygasł {0}.", "Your patron zone access expired on {0}.", passDate(language, pass.expiresAt))}
      </p>
      {pass.state !== "none" && <PassReceipt tx={tx} language={language} pass={pass} />}
      <p className="text-[13px] text-[var(--chan-muted)]">{tx("Dostęp nie odnawia się sam. Kolejna wpłata przedłuży go o {0} dni.", "Access does not renew by itself. Another payment extends it by {0} days.", offer.accessDays)}</p>
      <a
        href={getLocalizedHref(language, "pass")}
        className="inline-flex min-h-11 items-center rounded-[12px] bg-[var(--chan-ink)] px-4 text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2"
      >
        {pass.state === "none" ? tx("Zostań patronem", "Become a patron") : tx("Przedłuż dostęp", "Extend access")}
      </a>
    </div>
  );
}
