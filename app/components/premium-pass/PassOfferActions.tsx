"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.2): the buy buttons of the offer page.
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

type Pending = { productId: string } | null;

/** One shared checkout for every card of the page; `productId` preselects the card's pass. */
export function PassOfferActions({ offer, productId, firstSlug }: { offer: PremiumPassOffer; productId: string; firstSlug: string | null }) {
  const { tx, language } = useLanguage();
  const { userId, isLoaded } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [pending, setPending] = useState<Pending>(null);
  const product = offer.products.find((p) => p.id === productId) ?? offer.products[0]!;

  useEffect(() => {
    if (!isLoaded || !userId) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(PASS_CHECKOUT_PARAM) !== productId) return;
      url.searchParams.delete(PASS_CHECKOUT_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
      setPending({ productId });
    } catch {
      // ignore
    }
  }, [isLoaded, userId, productId]);

  const buy = useCallback(() => {
    if (userId) {
      setPending({ productId });
      return;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(PASS_CHECKOUT_PARAM, productId);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // ignore
    }
    openAuthModal("sign-in");
  }, [openAuthModal, productId, userId]);

  const watch = () => {
    const home = getLocalizedHref(language, "home");
    window.location.assign(firstSlug ? `${home}?v=${encodeURIComponent(firstSlug)}` : home);
  };

  return (
    <>
      <button type="button" className={styles.inkBtn} onClick={buy}>
        <TicketIcon />
        {userId
          ? tx("Kup wejściówkę · {0}", "Get the pass · {0}", price(language, product.priceMinor))
          : tx("Zaloguj się i kup wejściówkę", "Sign in to get the pass")}
      </button>
      {userId && (
        <PassCheckoutSheet
          open={pending !== null}
          onOpenChange={(open) => { if (!open) setPending(null); }}
          offer={{ ...offer, signedIn: true }}
          initialProductId={pending?.productId ?? productId}
          onWatch={watch}
        />
      )}
    </>
  );
}

/** The demo panel on the offer page (reloads the page to show the new state). */
export function PassOfferDemoControls() {
  return <DemoControls onChanged={() => window.location.reload()} />;
}
