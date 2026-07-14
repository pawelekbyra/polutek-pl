"use client";

import { useId, type MouseEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { useReducedMotion } from "framer-motion";
import { Gem, Lock } from "lucide-react";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { cn } from "@/lib/utils";
import { useAuthModal } from "./auth/AuthModalProvider";
import { useLanguage } from "./LanguageContext";
import { PlayerStateFrame } from "./PlayerStateFrame";
import styles from "./AccessLockOverlay.module.css";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { isSignedIn } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const isPl = language === "pl";
  const isCompact = variant !== "default";
  const isPatron = state === "PATRON_REQUIRED";

  const handleSupport = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("polutek:open-support"));
    window.requestAnimationFrame(() => {
      document.getElementById("donations")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    });
  };

  if (isCompact) {
    const label = isPatron
      ? isPl
        ? "Strefa Fenkju"
        : "Thank You Zone"
      : isPl
        ? "Zaloguj się"
        : "Sign in";
    const Icon = isPatron ? Gem : Lock;

    return (
      <PlayerStateFrame
        fill
        className={variant === "thumbnailCompact" ? "rounded-md" : "rounded-lg"}
      >
        <div
          className={cn(
            styles.compact,
            isPatron ? styles.patron : styles.login,
            variant === "thumbnailCompact" && styles.compactTiny,
          )}
          role="img"
          aria-label={label}
        >
          <span className={styles.compactMark} aria-hidden="true">
            <Icon />
          </span>
          <span className={styles.compactLabel}>{label}</span>
        </div>
      </PlayerStateFrame>
    );
  }

  return (
    <PlayerStateFrame className="rounded-[18px]">
      <section
        className={cn(styles.scene, isPatron ? styles.patron : styles.login)}
        aria-labelledby={titleId}
      >
        <span className={styles.glow} aria-hidden="true" />
        <span className={styles.noise} aria-hidden="true" />
        {isPatron ? (
          <PatronScene
            isPl={isPl}
            isSignedIn={isSignedIn === true}
            titleId={titleId}
            onSignIn={() => openAuthModal("sign-in")}
            onSupport={handleSupport}
          />
        ) : (
          <LoginScene
            isPl={isPl}
            titleId={titleId}
            onSignIn={() => openAuthModal("sign-in")}
          />
        )}
      </section>
    </PlayerStateFrame>
  );
}

function LoginScene({
  isPl,
  titleId,
  onSignIn,
}: {
  isPl: boolean;
  titleId: string;
  onSignIn: () => void;
}) {
  return (
    <div className={styles.content}>
      <Lock aria-hidden="true" className={styles.mark} />
      <h2 id={titleId} className={styles.heading}>
        <span className={cn(styles.word, styles.wordWhite)}>
          {isPl ? "Strefa" : "Members"}
        </span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={cn(styles.word, styles.wordBlue)}>
          {isPl ? "Zalogowanych" : "Zone"}
        </span>
      </h2>
      <button type="button" onClick={onSignIn} className={styles.cta}>
        <span className={styles.ctaLine} aria-hidden="true" />
        <span className={styles.ctaText}>
          {isPl ? "Zaloguj się, aby obczaić" : "Sign in to keep watching"}
        </span>
      </button>
    </div>
  );
}

function PatronScene({
  isPl,
  isSignedIn,
  titleId,
  onSignIn,
  onSupport,
}: {
  isPl: boolean;
  isSignedIn: boolean;
  titleId: string;
  onSignIn: () => void;
  onSupport: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className={styles.content}>
      <Gem aria-hidden="true" className={styles.mark} />
      <h2 id={titleId} className={styles.heading}>
        <span className={cn(styles.word, styles.wordAmber)}>
          {isPl ? "Strefa" : "Thank You"}
        </span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={cn(styles.word, styles.wordWhite)}>
          {isPl ? "Fenkjuu" : "Zone"}
        </span>
      </h2>
      {isSignedIn ? (
        <a href="#donations" onClick={onSupport} className={styles.cta}>
          <span className={styles.ctaLine} aria-hidden="true" />
          <span className={styles.ctaText}>
            {isPl ? "Odblokuj dostęp" : "Unlock access"}
          </span>
        </a>
      ) : (
        <button type="button" onClick={onSignIn} className={styles.cta}>
          <span className={styles.ctaLine} aria-hidden="true" />
          <span className={styles.ctaText}>
            {isPl ? "Zaloguj się" : "Sign in"}
          </span>
        </button>
      )}
    </div>
  );
}

export default AccessLockOverlay;
