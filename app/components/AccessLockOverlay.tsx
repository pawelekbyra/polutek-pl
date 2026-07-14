"use client";

import { useId, type CSSProperties, type MouseEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, LockKeyhole, Sparkles } from "lucide-react";
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

const CONSTELLATION_POINTS = [
  [12, 24, 3],
  [25, 67, 2],
  [34, 18, 2],
  [43, 82, 3],
  [54, 34, 2],
  [63, 68, 2],
  [72, 15, 3],
  [79, 47, 2],
  [88, 76, 3],
  [93, 27, 2],
] as const;

const CONSTELLATION = CONSTELLATION_POINTS.map(
  ([left, top, size], index) => ({
    key: `${left}-${top}`,
    style: {
      left: `${left}%`,
      top: `${top}%`,
      width: size,
      height: size,
      "--star-index": index,
    } as CSSProperties,
  }),
);

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { isSignedIn } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const isPl = language === "pl";
  const isCompact = variant !== "default";

  // A guest always gets the sign-in path first, even when the backend correctly
  // reports that the final tier is PATRON. This affects copy only, never access.
  const isPatronExperience =
    state === "PATRON_REQUIRED" && isSignedIn === true;
  const Icon = isPatronExperience ? Crown : LockKeyhole;

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
    const isTiny = variant === "thumbnailCompact";
    const label = isPatronExperience
      ? isPl
        ? "Dla Patronów"
        : "Patrons only"
      : isPl
        ? "Zaloguj się"
        : "Sign in";

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className={cn(
            styles.compact,
            isPatronExperience ? styles.patron : styles.login,
            isTiny && styles.compactTiny,
          )}
          role="img"
          aria-label={label}
        >
          <span className={styles.compactGlow} aria-hidden="true" />
          <span className={styles.compactMark} aria-hidden="true">
            <Icon />
          </span>
          <span className={styles.compactLabel}>{label}</span>
        </div>
      </PlayerStateFrame>
    );
  }

  const eyebrow = isPatronExperience
    ? isPl
      ? "Premiera dla wspierających"
      : "Supporter premiere"
    : isPl
      ? "Zaloguj się i oglądaj dalej"
      : "Sign in and keep watching";
  const title = isPatronExperience
    ? isPl
      ? "Ten materiał czeka na Patronów"
      : "This release is for Patrons"
    : isPl
      ? "Twoje miejsce jest już gotowe"
      : "Your seat is ready";
  const description = isPatronExperience
    ? isPl
      ? "Jednorazowe wsparcie spełniające próg odblokowuje dostęp na zawsze. Bez subskrypcji."
      : "One qualifying contribution unlocks permanent access. No subscription."
    : isPl
      ? "Zaloguj się bezpłatnie, aby uruchomić ten film i wrócić do swojej historii."
      : "Sign in for free to play this video and return to your watch history.";

  return (
    <PlayerStateFrame className="rounded-[18px]">
      <section
        className={cn(
          styles.scene,
          isPatronExperience ? styles.patron : styles.login,
        )}
        aria-labelledby={titleId}
      >
        <div className={styles.ambient} aria-hidden="true">
          <span className={styles.glowOne} />
          <span className={styles.glowTwo} />
          <span className={styles.orbitOne} />
          <span className={styles.orbitTwo} />
          {CONSTELLATION.map((star) => (
            <span
              key={star.key}
              className={styles.star}
              style={star.style}
            />
          ))}
        </div>

        <motion.div
          className={styles.panel}
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className={styles.art} aria-hidden="true">
            <span className={styles.artHalo} />
            <span className={styles.artRing} />
            <motion.span
              className={styles.artMark}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.78 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 320, damping: 22, delay: 0.08 }
              }
            >
              <Icon />
            </motion.span>
            <Sparkles className={styles.sparkle} />
          </div>

          <div className={styles.content}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true" />
              {eyebrow}
            </p>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <p className={styles.description}>{description}</p>

            {isPatronExperience ? (
              <a
                href="#donations"
                onClick={handleSupport}
                className={cn(styles.cta, styles.patronCta)}
              >
                <Crown aria-hidden="true" />
                {isPl ? "Wesprzyj jednorazowo" : "Support once"}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("sign-in")}
                className={cn(styles.cta, styles.loginCta)}
              >
                <LockKeyhole aria-hidden="true" />
                {isPl ? "Zaloguj się" : "Sign in"}
              </button>
            )}
          </div>
        </motion.div>
      </section>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;
