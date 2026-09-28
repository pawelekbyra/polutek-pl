"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { cn } from "@/lib/utils";
import { formatPremiereCountdown } from "@/lib/temp-patron-coming-soon";
import { useAuthModal } from "./auth/AuthModalProvider";
import { useLanguage } from "./LanguageContext";
import { PlayerStateFrame } from "./PlayerStateFrame";
import styles from "./AccessLockOverlay.module.css";

// "COMING_SOON" is not a real PlaybackPlanStatus — see lib/temp-patron-coming-soon.ts.
type AccessLockState = Extract<PlaybackPlanStatus, "LOGIN_REQUIRED"> | "COMING_SOON";

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const isPl = language === "pl";
  const isCompact = variant !== "default";
  const isComingSoon = state === "COMING_SOON";

  const [countdownNow, setCountdownNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (!isComingSoon) return;
    const id = setInterval(() => setCountdownNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, [isComingSoon]);
  const countdownLabel = formatPremiereCountdown(isPl, undefined, countdownNow);

  if (isCompact) {
    if (isComingSoon) {
      return (
        <PlayerStateFrame
          fill
          className={variant === "thumbnailCompact" ? "rounded-md" : "rounded-lg"}
        >
          <div
            className={cn(
              styles.compact,
              styles.patron,
              variant === "thumbnailCompact" && styles.compactTiny,
            )}
            role="img"
            aria-label={countdownLabel}
          >
            <span className={styles.compactCyberLabel} aria-hidden="true">
              {isPl ? "WKRÓTCE" : "SOON"}
            </span>
            <span className={styles.compactCyberCountdown}>{countdownLabel}</span>
          </div>
        </PlayerStateFrame>
      );
    }

    return (
      <PlayerStateFrame
        fill
        className={variant === "thumbnailCompact" ? "rounded-md" : "rounded-lg"}
      >
        <div
          className={cn(
            styles.compact,
            styles.login,
            variant === "thumbnailCompact" && styles.compactTiny,
          )}
          role="img"
          aria-label={isPl ? "Zaloguj się" : "Sign in"}
        >
          <img
            src={isPl ? "/wall-login-pl.png" : "/wall-login-en.png"}
            alt=""
            className={styles.compactLoginImage}
            draggable={false}
          />
        </div>
      </PlayerStateFrame>
    );
  }

  const handleSignIn = () => openAuthModal("sign-in");

  return (
    <PlayerStateFrame className="rounded-none lg:rounded-[18px]">
      <section
        className={cn(styles.scene, isComingSoon ? styles.patron : styles.login, !isComingSoon && styles.loginClickable)}
        aria-labelledby={titleId}
        {...(!isComingSoon && {
          role: "button",
          tabIndex: 0,
          onClick: handleSignIn,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") handleSignIn();
          },
        })}
      >
        {isComingSoon && (
          <>
            <span className={styles.cyberScanlines} aria-hidden="true" />
            <span className={styles.cyberGrid} aria-hidden="true" />
          </>
        )}
        {isComingSoon ? (
          <ComingSoonScene
            isPl={isPl}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
            countdownLabel={countdownLabel}
          />
        ) : (
          <LoginScene
            isPl={isPl}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
          />
        )}
      </section>
    </PlayerStateFrame>
  );
}

function LoginScene({
  isPl,
  reduceMotion,
  titleId,
}: {
  isPl: boolean;
  reduceMotion: boolean;
  titleId: string;
}) {
  return (
    <div className={styles.graffitiContent}>
      <motion.div
        id={titleId}
        role="img"
        aria-label={isPl ? "Nie masz psychy sie zalogowac" : "You don't have guts to log in"}
        className={styles.graffitiImageWrap}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 160, damping: 18, delay: 0.05 }
        }
      >
        <img
          src={isPl ? "/wall-text-pl.png" : "/wall-text-en.png"}
          alt=""
          className={styles.graffitiImage}
          draggable={false}
        />
      </motion.div>
    </div>
  );
}

function ComingSoonScene({
  isPl,
  reduceMotion,
  titleId,
  countdownLabel,
}: {
  isPl: boolean;
  reduceMotion: boolean;
  titleId: string;
  countdownLabel: string;
}) {
  return (
    <div className={styles.cyberContent}>
      <motion.h2
        id={titleId}
        className={styles.cyberHeading}
        initial={reduceMotion ? false : { opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
      >
        {isPl ? "JUŻ WKRÓTCE" : "COMING SOON"}
      </motion.h2>
      <motion.span
        className={styles.cyberLine}
        aria-hidden="true"
        initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.3 }}
      />
      <motion.p
        className={styles.cyberCountdown}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.55 }}
      >
        {countdownLabel}
      </motion.p>
    </div>
  );
}

export default AccessLockOverlay;
