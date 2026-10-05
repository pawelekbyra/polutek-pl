"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { cn } from "@/lib/utils";
import { formatPremiereCountdown, formatPremiereDate, toPremiereDate } from "@/lib/premiere";
import dynamic from "next/dynamic";
import { PremieraLettering } from "./coming-soon/PremieraLettering";
import { useAuthModal } from "./auth/AuthModalProvider";
import { useLanguage } from "./LanguageContext";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { useRenderClock } from "./RenderClock";
import styles from "./AccessLockOverlay.module.css";

// The premiere cockpit (HUD, countdown, audio) is only needed while a premiere is upcoming, so it
// is its own chunk instead of part of every page with a player.
const CockpitComingSoon = dynamic(
  () => import("./coming-soon/CockpitComingSoon").then((m) => m.CockpitComingSoon),
);
import type { Tx } from "@/lib/i18n/ui";

// COMING_SOON = a scheduled premiere not reached yet (CLAUDE.md "Premieres"), shown to
// signed-in viewers; guests get LOGIN_REQUIRED for the same video.
type AccessLockState = Extract<PlaybackPlanStatus, "LOGIN_REQUIRED" | "COMING_SOON">;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
  /** The video's own premiere time; required for COMING_SOON. */
  premiereAt?: Date | string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

// DSEG7 draws "1" at the right of a full-width cell, leaving a hole before it. Pull back only a
// "1" that follows another digit; a leading "1" has nothing to close up to.
function tightenSegmentOnes(text: string, className: string) {
  return Array.from(text).map((ch, i) =>
    ch === "1" && /\d/.test(text[i - 1] ?? "") ? (
      <span key={i} className={className}>
        {ch}
      </span>
    ) : (
      ch
    ),
  );
}

function useCountdownUnits(now: Date, target: Date) {
  let diff = Math.max(0, target.getTime() - now.getTime());
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000); diff -= h * 3600000;
  const m = Math.floor(diff / 60000); diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return [pad(d), pad(h), pad(m), pad(s)];
}

export function AccessLockOverlay({ state, variant, premiereAt }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const { tx } = useLanguage();
  const isCompact = variant !== "default";
  const isComingSoon = state === "COMING_SOON";

  // The cockpit is rendered on the server for a signed-in viewer (the session is in the page), so
  // the first countdown uses the server's render time (RenderClock) to hydrate the same digits;
  // the live clock takes over right after.
  const renderNow = useRenderClock();
  const [countdownNow, setCountdownNow] = useState<Date>(() => renderNow ?? new Date());
  // A missing date (should not happen) degrades to a zeroed countdown instead of crashing.
  const premiereDate = toPremiereDate(premiereAt) ?? countdownNow;
  // Only the full-size cockpit ticks; compact thumbnails show a static date and many can
  // be mounted at once in the playlist.
  const ticks = isComingSoon && !isCompact;
  useEffect(() => {
    if (!ticks) return;
    const tick = () => setCountdownNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ticks]);

  const countdownLabel = formatPremiereCountdown(tx, premiereDate, countdownNow);
  const units = useCountdownUnits(countdownNow, premiereDate);

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
            aria-label={`${tx("Premiera", "Premiere")} ${formatPremiereDate(premiereDate)}`}
          >
            <PremieraLettering tx={tx} className={styles.compactPremiereLabel} />
            <span className={styles.compactPremiereDate} aria-hidden="true">
              {tightenSegmentOnes(formatPremiereDate(premiereDate), styles.compactPremiereDateOne)}
            </span>
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
          aria-label={tx("Zaloguj się", "Sign in")}
        >
          <img
            src={tx("/wall-login-pl.png", "/wall-login-en.png")}
            alt=""
            className={styles.compactLoginImage}
            // The lettering sits off-centre inside the PNG (measured: PL centre at 52.1% / 49%,
            // EN at 56.7% / 49%), so nudge the image to put the words in the middle of the tile.
            style={{ transform: tx("translate(-2.1%, 1%)", "translate(-6.7%, 1%)") }}
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
            tx={tx}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
            units={units}
            countdownLabel={countdownLabel}
            premiereAt={premiereDate}
          />
        ) : (
          <LoginScene
            tx={tx}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
          />
        )}
      </section>
    </PlayerStateFrame>
  );
}

function LoginScene({
  tx,
  reduceMotion,
  titleId,
}: {
  tx: Tx;
  reduceMotion: boolean;
  titleId: string;
}) {
  return (
    <div className={styles.graffitiContent}>
      <motion.div
        id={titleId}
        role="img"
        aria-label={tx("Nie masz psychy sie zalogowac", "You don't have guts to log in")}
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
          src={tx("/wall-text-pl.png", "/wall-text-en.png")}
          alt=""
          className={styles.graffitiImage}
          draggable={false}
        />
      </motion.div>
    </div>
  );
}

export default AccessLockOverlay;
