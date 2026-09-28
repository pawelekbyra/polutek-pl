"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { cn } from "@/lib/utils";
import { PATRON_COMING_SOON_TARGET, formatPremiereCountdown, formatPremiereDate } from "@/lib/temp-patron-coming-soon";
import { CockpitComingSoon } from "./coming-soon/CockpitComingSoon";
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

const pad = (n: number) => String(n).padStart(2, "0");

function useCountdownUnits(now: Date, target: Date) {
  let diff = Math.max(0, target.getTime() - now.getTime());
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000); diff -= h * 3600000;
  const m = Math.floor(diff / 60000); diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return [pad(d), pad(h), pad(m), pad(s)];
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
  const units = useCountdownUnits(countdownNow, PATRON_COMING_SOON_TARGET);

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
            <span className={styles.compactPremiereLabel} aria-hidden="true">PREMIERA</span>
            <span className={styles.compactPremiereDate} aria-hidden="true">{formatPremiereDate()}</span>
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
        {isComingSoon ? (
          <CockpitComingSoon
            isPl={isPl}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
            units={units}
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

export default AccessLockOverlay;
