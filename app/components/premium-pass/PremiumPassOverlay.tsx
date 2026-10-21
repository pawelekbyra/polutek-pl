"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.1): the locked stage in place of the player
// for a PASS_REQUIRED plan (the patron zone). The player is never mounted here and nothing about the stream is
// requested: the plan carries only offer data (amounts) and the public poster.
import React, { useCallback, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/react";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { patronCurrencyForLanguage } from "@/lib/modules/experiment-premium-pass/domain/config";
import { cheapestProduct, type PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { useAuthModal } from "../auth/AuthModalProvider";
import { useLanguage } from "../LanguageContext";
import { PlayerStateFrame } from "../PlayerStateFrame";
import { PassCheckoutSheet } from "./PassCheckoutSheet";
import { DemoControls } from "./DemoControls";
import { LockIcon, TicketIcon } from "./PassIcons";
import { passDate, price } from "./pass-copy";
import styles from "./premium-pass.module.css";

/** Set before the sign-in window opens; read once after sign-in to reopen the checkout on the same video. */
export const PASS_CHECKOUT_PARAM = "pass";

function takeCheckoutIntent(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(PASS_CHECKOUT_PARAM) !== "checkout") return false;
    url.searchParams.delete(PASS_CHECKOUT_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
    return true;
  } catch {
    return false;
  }
}

function markCheckoutIntent() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(PASS_CHECKOUT_PARAM, "checkout");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // ignore: the viewer simply clicks the button again after signing in
  }
}

export interface PremiumPassOverlayProps {
  offer: PremiumPassOffer;
  poster?: string | null;
  title?: string | null;
  variant: "default" | "thumbnail" | "thumbnailCompact";
  /** Re-requests the playback plan (after a purchase or a demo-panel change). */
  onRefresh: () => void;
}

export function PremiumPassOverlay({ offer, poster, title, variant, onRefresh }: PremiumPassOverlayProps) {
  const { tx, language } = useLanguage();
  const { userId, isLoaded } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const titleId = useId();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const signedIn = Boolean(userId) && offer.signedIn;
  const currency = patronCurrencyForLanguage(language);
  const from = price(language, cheapestProduct(offer, currency).prices[currency], currency);
  const demo = offer.payments.mode === "demo";
  const testMode = offer.payments.mode === "stripe" && offer.payments.available && offer.payments.stripeMode === "test";

  // After sign-in the plan is requested again; the overlay of the new (signed-in) plan reopens the checkout.
  useEffect(() => {
    if (isLoaded && signedIn && takeCheckoutIntent()) setCheckoutOpen(true);
  }, [isLoaded, signedIn]);

  const start = useCallback(() => {
    if (signedIn) {
      setCheckoutOpen(true);
      return;
    }
    markCheckoutIntent();
    openAuthModal("sign-in");
  }, [openAuthModal, signedIn]);

  if (variant !== "default") {
    return (
      <PlayerStateFrame fill className={cn(styles.pass, "rounded-md")}>
        <div className={styles.stage} role="img" aria-label={tx("Film w strefie patrona", "Patron zone video")}>
          {poster && <div className={styles.poster} style={{ backgroundImage: `url("${poster}")` }} aria-hidden="true" />}
          <span className={cn(styles.badge, styles.stageBadge)}><LockIcon />PATRON</span>
        </div>
      </PlayerStateFrame>
    );
  }

  const ctaLabel = !signedIn
    ? tx("Zaloguj się i zostań patronem", "Sign in to become a patron")
    : offer.expiredAt
      ? tx("Wesprzyj ponownie · od {0}", "Support again · from {0}", from)
      : tx("Zostań patronem · od {0}", "Become a patron · from {0}", from);

  return (
    <PlayerStateFrame className="rounded-none">
      <section className={cn(styles.pass, styles.stage)} aria-labelledby={titleId} data-premium-pass-stage="">
        {poster && <div className={styles.poster} style={{ backgroundImage: `url("${poster}")` }} aria-hidden="true" />}
        <span className={cn(styles.badge, styles.stageBadge)}><LockIcon />PATRON</span>
        {demo && <span className={styles.stageDemo}>{tx("TRYB DEMO", "DEMO MODE")}</span>}
        {testMode && <span className={styles.stageDemo}>{tx("TRYB TESTOWY", "TEST MODE")}</span>}
        <div className={styles.stageInner}>
          {offer.expiredAt && (
            <span className={styles.expired} role="status">
              {tx("Twój dostęp do strefy patrona wygasł {0}.", "Your patron zone access expired on {0}.", passDate(language, offer.expiredAt))}
            </span>
          )}
          <div className={styles.lockRing} aria-hidden="true"><LockIcon /></div>
          <h2 id={titleId} className={styles.stageTitle}>{tx("Strefa patrona", "Patron zone")}</h2>
          <p className={styles.stageSub}>{title ? `${title} · ` : ""}{tx("tylko dla patronów projektu", "for the project's patrons only")}</p>
          <div className={styles.offer}>
            <div>
              <div className={styles.offerName}>{tx("Zostań patronem i uzyskaj dostęp do strefy premium", "Become a patron and get access to the premium zone")}</div>
              <ul className={styles.offerPerks}>
                <li>{tx("Wszystkie filmy strefy patrona ({0})", "All patron zone videos ({0})", offer.premiumCount)}</li>
                <li>{tx("dostęp na 30 dni od {0}", "30-day access from {0}", from)}</li>
                <li>{tx("albo dostęp bez limitu, bez subskrypcji", "or unlimited access, no subscription")}</li>
              </ul>
            </div>
            <button type="button" className={styles.goldBtn} onClick={start}>
              <TicketIcon />
              {ctaLabel}
            </button>
          </div>
          <button type="button" className={cn(styles.goldBtn, styles.onlyNarrow)} onClick={start}>
            <TicketIcon />
            {ctaLabel}
          </button>
          <span className={styles.tiny}>
            {signedIn
              ? tx("Dostęp na 30 dni albo bez limitu, bez subskrypcji", "30-day or unlimited access, no subscription")
              : tx("Konto jest darmowe. Po zalogowaniu wrócisz do zakupu.", "The account is free. After signing in you come back to the purchase.")}
            {" · "}
            <a className={styles.stageLink} href={getLocalizedHref(language, "pass")}>{tx("Co jest w środku?", "What's inside?")}</a>
          </span>
        </div>
      </section>
      {signedIn && (
        <>
          <PassCheckoutSheet open={checkoutOpen} onOpenChange={setCheckoutOpen} offer={offer} onWatch={onRefresh} />
          {(demo || testMode) && <DemoControls onChanged={onRefresh} />}
        </>
      )}
    </PlayerStateFrame>
  );
}
