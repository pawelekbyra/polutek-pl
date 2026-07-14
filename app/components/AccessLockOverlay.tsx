"use client";

import { useId, type MouseEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Rocket, Key } from "lucide-react";
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
    const Icon = isPatron ? Star : Key;

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
        <div className={styles.aurora} aria-hidden="true">
          <span className={styles.blob1} />
          <span className={styles.blob2} />
          <span className={styles.blob3} />
        </div>
        <span className={styles.sheen} aria-hidden="true" />
        <span className={styles.noise} aria-hidden="true" />
        {isPatron ? (
          <PatronScene
            isPl={isPl}
            isSignedIn={isSignedIn === true}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
            onSignIn={() => openAuthModal("sign-in")}
            onSupport={handleSupport}
          />
        ) : (
          <LoginScene
            isPl={isPl}
            reduceMotion={Boolean(reduceMotion)}
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
  reduceMotion,
  titleId,
  onSignIn,
}: {
  isPl: boolean;
  reduceMotion: boolean;
  titleId: string;
  onSignIn: () => void;
}) {
  return (
    <div className={styles.content}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 16 }}
      >
        <Rocket aria-hidden="true" className={styles.mark} />
      </motion.div>
      <h2 id={titleId} className={styles.heading}>
        <motion.span
          className={cn(styles.word, styles.wordWhite)}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.1 }}
        >
          {isPl ? "Strefa" : "Members"}
        </motion.span>
        <motion.span
          className={styles.divider}
          aria-hidden="true"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.22 }}
        />
        <motion.span
          className={cn(styles.word, styles.wordBlue)}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.28 }}
        >
          {isPl ? "Zalogowanych" : "Zone"}
        </motion.span>
      </h2>
      <motion.button
        type="button"
        onClick={onSignIn}
        className={styles.cta}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.44 }}
      >
        <span className={styles.ctaLine} aria-hidden="true" />
        <span className={styles.ctaText}>
          {isPl ? "Zaloguj się, aby obczaić" : "Sign in to keep watching"}
        </span>
      </motion.button>
    </div>
  );
}

function PatronScene({
  isPl,
  isSignedIn,
  reduceMotion,
  titleId,
  onSignIn,
  onSupport,
}: {
  isPl: boolean;
  isSignedIn: boolean;
  reduceMotion: boolean;
  titleId: string;
  onSignIn: () => void;
  onSupport: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className={styles.content}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6, rotate: 10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 16 }}
      >
        <Star aria-hidden="true" className={styles.mark} />
      </motion.div>
      <h2 id={titleId} className={styles.heading}>
        <motion.span
          className={cn(styles.word, styles.wordAmber)}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.1 }}
        >
          {isPl ? "Strefa" : "Thank You"}
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
          {isPl ? "Fenkjuu" : "Zone"}
        </motion.span>
      </h2>
      {isSignedIn ? (
        <motion.a
          href="#donations"
          onClick={onSupport}
          className={styles.cta}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.44 }}
        >
          <span className={styles.ctaLine} aria-hidden="true" />
          <span className={styles.ctaText}>
            {isPl ? "Odblokuj dostęp" : "Unlock access"}
          </span>
        </motion.a>
      ) : (
        <motion.button
          type="button"
          onClick={onSignIn}
          className={styles.cta}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.44 }}
        >
          <span className={styles.ctaLine} aria-hidden="true" />
          <span className={styles.ctaText}>
            {isPl ? "Zostań Patronem Projektu" : "Become a Project Patron"}
          </span>
        </motion.button>
      )}
    </div>
  );
}

export default AccessLockOverlay;
