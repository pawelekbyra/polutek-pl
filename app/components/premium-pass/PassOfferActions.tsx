"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.2): the "become a patron" button of the offer page.
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/react";
import { getLocalizedHref } from "@/lib/i18n/routing";
import type { PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { useAuthModal } from "../auth/AuthModalProvider";
import { useLanguage } from "../LanguageContext";
import { PassCheckoutSheet } from "./PassCheckoutSheet";
import { DemoControls } from "./DemoControls";
import { TicketIcon } from "./PassIcons";
import { PASS_CHECKOUT_PARAM } from "./PremiumPassOverlay";
import { price } from "./pass-copy";
import styles from "./premium-pass.module.css";

/** The button and the checkout it opens; `firstSlug` is where "enter the patron zone" goes after a success. */
export function PassOfferActions({ offer, firstSlug }: { offer: PremiumPassOffer; firstSlug: string | null }) {
  const { tx, language } = useLanguage();
  const { userId, isLoaded } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [open, setOpen] = useState(false);

  // After sign-in the page is shown again; the marker set before the sign-in window reopens the checkout.
  useEffect(() => {
    if (!isLoaded || !userId) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(PASS_CHECKOUT_PARAM) !== "checkout") return;
      url.searchParams.delete(PASS_CHECKOUT_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
      setOpen(true);
    } catch {
      // ignore
    }
  }, [isLoaded, userId]);

  const buy = useCallback(() => {
    if (userId) {
      setOpen(true);
      return;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(PASS_CHECKOUT_PARAM, "checkout");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // ignore
    }
    openAuthModal("sign-in");
  }, [openAuthModal, userId]);

  const watch = () => {
    const home = getLocalizedHref(language, "home");
    window.location.assign(firstSlug ? `${home}?v=${encodeURIComponent(firstSlug)}` : home);
  };

  return (
    <>
      <button type="button" className={styles.inkBtn} onClick={buy}>
        <TicketIcon />
        {userId ? tx("Zostań patronem · od {0}", "Become a patron · from {0}", price(language, offer.minMinor)) : tx("Zaloguj się i zostań patronem", "Sign in to become a patron")}
      </button>
      {userId && <PassCheckoutSheet open={open} onOpenChange={setOpen} offer={{ ...offer, signedIn: true }} onWatch={watch} />}
    </>
  );
}

/** The demo panel on the offer page (reloads the page to show the new state). */
export function PassOfferDemoControls() {
  return <DemoControls onChanged={() => window.location.reload()} />;
}
