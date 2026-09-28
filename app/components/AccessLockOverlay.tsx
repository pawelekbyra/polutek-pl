"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Rocket } from "lucide-react";
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
    const label = isComingSoon ? countdownLabel : isPl ? "Zaloguj się" : "Sign in";
    const Icon = isComingSoon ? Rocket : Star;

    return (
      <PlayerStateFrame
        fill
        className={variant === "thumbnailCompact" ? "rounded-md" : "rounded-lg"}
      >
        <div
          className={cn(
            styles.compact,
            isComingSoon ? styles.patron : styles.login,
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

  const handleSignIn = () => openAuthModal("sign-in");

  return (
    <PlayerStateFrame className="rounded-[18px]">
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
            <div className={styles.aurora} aria-hidden="true">
              <span className={styles.blob1} />
              <span className={styles.blob2} />
              <span className={styles.blob3} />
            </div>
            <span className={styles.sheen} aria-hidden="true" />
            <span className={styles.noise} aria-hidden="true" />
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
    <div className={styles.content}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6, rotate: 10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 16 }}
      >
        <Rocket aria-hidden="true" className={styles.mark} />
      </motion.div>
      <h2 id={titleId} className={styles.heading}>
        <motion.span
          className={cn(styles.word, styles.wordAmber)}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.1 }}
        >
          {isPl ? "Juu017c" : "Coming"}
        </motion.span>
        <motion.span
          className={styles.divider}
          aria-hidden="true"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.22 }}
        />
        <motion.span
          className={cn(styles.word, styles.wordWhite)}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.28 }}
        >
          {isPl ? "wkru00f3tce" : "soon"}
        </motion.span>
      </h2>
      <motion.div
        className={styles.cta}
        style={{ cursor: "default" }}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.44 }}
      >
        <span className={styles.ctaLine} aria-hidden="true" />
        <span className={styles.ctaText}>{countdownLabel}</span>
      </motion.div>
    </div>
  );
}

export default AccessLockOverlay;
