"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): Hero's "Zostań patronem" button opens the patron checkout
// (the two-step Stripe one) through the "polutek:open-patron" event. When the experiment is not visible to the viewer
// (flag off, 404 from the offer route) it falls back to the old tip gate (SupportModal, "polutek:open-support"), which
// stays in the code: switching the experiment off puts the button back on the tip gate by itself.
import React, { useEffect, useState } from "react";
import type { PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
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
        if (!alive) return;
        if (!status) {
          window.dispatchEvent(new CustomEvent("polutek:open-support"));
          return;
        }
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
