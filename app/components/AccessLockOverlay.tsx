"use client";

import { useId, type MouseEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, LogIn, Play, Sparkles, Star, Ticket } from "lucide-react";
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
    const Icon = isPatron ? Heart : Ticket;

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
          <span className={styles.compactPattern} aria-hidden="true" />
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
    <div className={styles.loginLayout}>
      <div className={styles.loginArtwork} aria-hidden="true">
        <span className={styles.loginCloudOne} />
        <span className={styles.loginCloudTwo} />
        <motion.div
          className={styles.ticket}
          initial={reduceMotion ? false : { opacity: 0, rotate: -7, y: 12 }}
          animate={{ opacity: 1, rotate: -3, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 240, damping: 20 }
          }
        >
          <span className={styles.ticketStub}>POLUTEK.PL</span>
          <span className={styles.ticketPlay}><Play fill="currentColor" /></span>
          <span className={styles.ticketSeat}>01</span>
        </motion.div>
        <span className={styles.loginDotOne} />
        <span className={styles.loginDotTwo} />
      </div>

      <motion.div
        className={styles.loginContent}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.06 }}
      >
        <p className={styles.loginEyebrow}>
          <Ticket aria-hidden="true" />
          {isPl ? "Bezpłatny bilet" : "Free ticket"}
        </p>
        <h2 id={titleId} className={styles.title}>
          {isPl ? "Mamy dla Ciebie miejsce" : "We saved you a seat"}
        </h2>
        <p className={styles.description}>
          {isPl
            ? "Zaloguj się i oglądaj dalej. To zajmie chwilę — popcorn może zostać na stole."
            : "Sign in and keep watching. It only takes a moment — your popcorn can stay put."}
        </p>
        <button type="button" onClick={onSignIn} className={cn(styles.cta, styles.loginCta)}>
          <LogIn aria-hidden="true" />
          {isPl ? "Zaloguj się" : "Sign in"}
        </button>
      </motion.div>
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
    <div className={styles.patronLayout}>
      <div className={styles.patronRays} aria-hidden="true" />
      <div className={styles.patronConfetti} aria-hidden="true">
        <Star className={styles.confettiStarOne} fill="currentColor" />
        <Star className={styles.confettiStarTwo} fill="currentColor" />
        <Sparkles className={styles.confettiSparkle} />
        <span className={styles.confettiDotOne} />
        <span className={styles.confettiDotTwo} />
      </div>

      <motion.div
        className={styles.thankYouCard}
        initial={reduceMotion ? false : { opacity: 0, rotate: 4, scale: 0.94 }}
        animate={{ opacity: 1, rotate: 1.5, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 220, damping: 19 }
        }
        aria-hidden="true"
      >
        <span className={styles.cardTape} />
        <span className={styles.cardHeart}><Heart fill="currentColor" /></span>
        <span className={styles.cardThanks}>{isPl ? "DZIĘKUJĘ!" : "THANK YOU!"}</span>
        <span className={styles.cardForever}>{isPl ? "dostęp na zawsze" : "access forever"}</span>
      </motion.div>

      <motion.div
        className={styles.patronContent}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.08 }}
      >
        <p className={styles.patronEyebrow}>
          <Heart aria-hidden="true" fill="currentColor" />
          {isPl ? "Strefa Fenkju" : "Thank You Zone"}
        </p>
        <h2 id={titleId} className={styles.title}>
          {isPl ? "Tu wsparcie zamienia się w seanse" : "Support turns into screenings here"}
        </h2>
        <p className={styles.description}>
          {isSignedIn
            ? isPl
              ? "Jednorazowe wsparcie spełniające próg otwiera tę strefę na zawsze. Bez abonamentu."
              : "One qualifying tip opens this zone forever. No subscription."
            : isPl
              ? "To specjalny materiał dla wspierających. Zaloguj się, a pokażemy Ci drogę do stałego dostępu."
              : "This is a special release for supporters. Sign in and we’ll show you the way to permanent access."}
        </p>
        {isSignedIn ? (
          <a href="#donations" onClick={onSupport} className={cn(styles.cta, styles.patronCta)}>
            <Heart aria-hidden="true" fill="currentColor" />
            {isPl ? "Wesprzyj jednorazowo" : "Support once"}
          </a>
        ) : (
          <button type="button" onClick={onSignIn} className={cn(styles.cta, styles.patronCta)}>
            <LogIn aria-hidden="true" />
            {isPl ? "Zaloguj się" : "Sign in"}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default AccessLockOverlay;
