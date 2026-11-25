"use client";
// patron zone (docs/architecture/patron-zone.md): the gold "Kup se Premium" button in Hero opens the patron checkout
// (the three-step Stripe one) through the "polutek:open-patron" event. Hero offers this checkout to viewers without
// an active pass; viewers who already have one get the separate voluntary tip checkout.
// The video gate inside Hero (PremiumPassOverlay) opens this same checkout (PatronCheckoutHostContext): the host lives
// outside PremiumWrapper, so when the purchase succeeds and the gate is replaced by the player (no reload, see
// pass-activation.ts) the checkout and its success screen stay. It also takes the return from a redirect method.
import React, { createContext, useEffect, useState } from "react";
import type { PremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import { PASS_PAYMENT_PARAM, PassCheckoutSheet } from "./PassCheckoutSheet";
import { fetchPassStatus } from "./usePremiumPass";

export const OPEN_PATRON_EVENT = "polutek:open-patron";

/** True inside a subtree whose page mounts PatronCheckoutHost: the video gate then opens the host's checkout. */
export const PatronCheckoutHostContext = createContext(false);

export function openPatronCheckout(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PATRON_EVENT));
}

function hasRedirectReturn(): boolean {
  try {
    return new URL(window.location.href).searchParams.has(PASS_PAYMENT_PARAM);
  } catch {
    return false;
  }
}

export function PatronCheckoutHost() {
  const [offer, setOffer] = useState<PremiumPassOffer | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = (thenOpen: boolean) => {
      void fetchPassStatus(thenOpen ? "checkout" : undefined).then((status) => {
        if (!alive || !status) return;
        setOffer({ ...status.offer, signedIn: true });
        if (thenOpen) setOpen(true);
      });
    };
    const onOpen = () => load(true);
    window.addEventListener(OPEN_PATRON_EVENT, onOpen);
    // Back from a redirect method (Przelewy24...): mount the checkout; on mount it reads the return parameters and
    // reopens itself on the waiting screen.
    if (hasRedirectReturn()) load(false);
    return () => {
      alive = false;
      window.removeEventListener(OPEN_PATRON_EVENT, onOpen);
    };
  }, []);

  if (!offer) return null;
  // Everything on the page is already refreshed when the purchase succeeds: "Enter the Premium Zone" only closes the
  // checkout (it does so itself) and brings the player into view.
  return (
    <PassCheckoutSheet
      open={open}
      onOpenChange={setOpen}
      offer={offer}
      onWatch={() => document.querySelector("[data-player-slot]")?.scrollIntoView?.({ behavior: "smooth", block: "center" })}
    />
  );
}
