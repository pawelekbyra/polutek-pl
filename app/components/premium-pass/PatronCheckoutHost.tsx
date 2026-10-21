"use client";
// patron zone (docs/architecture/patron-zone.md): the gold "Kup se Premium" button in Hero opens the patron checkout
// (the three-step Stripe one) through the "polutek:open-patron" event. When the patron zone is not visible to the
// viewer (PREMIUM_PASS_EXPERIMENT=off, the offer route answers 404) nothing opens: the old tip gate is hidden and
// is no longer a fallback (app/components/channel/tip-gate.ts).
import React, { useEffect, useState } from "react";
import type { PremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import { PassCheckoutSheet } from "./PassCheckoutSheet";
import { fetchPassStatus } from "./usePremiumPass";

export const OPEN_PATRON_EVENT = "polutek:open-patron";

export function PatronCheckoutHost() {
  const [offer, setOffer] = useState<PremiumPassOffer | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const onOpen = () => {
      void fetchPassStatus("checkout").then((status) => {
        if (!alive || !status) return;
        setOffer({ ...status.offer, signedIn: true });
        setOpen(true);
      });
    };
    window.addEventListener(OPEN_PATRON_EVENT, onOpen);
    return () => {
      alive = false;
      window.removeEventListener(OPEN_PATRON_EVENT, onOpen);
    };
  }, []);

  if (!offer) return null;
  return <PassCheckoutSheet open={open} onOpenChange={setOpen} offer={offer} onWatch={() => window.location.reload()} />;
}
