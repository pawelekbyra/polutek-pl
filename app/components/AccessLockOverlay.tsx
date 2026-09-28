"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { cn } from "@/lib/utils";
import { PATRON_COMING_SOON_TARGET, formatPremiereCountdown } from "@/lib/temp-patron-coming-soon";
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

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ZXCV:=+*<>";

function MatrixRain({ columns = 28, seed = 7 }: { columns?: number; seed?: number }) {
  const cols = useMemo(() => {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    return Array.from({ length: columns }, (_, i) => {
      const len = 10 + Math.floor(rnd() * 20);
      const text = Array.from({ length: len }, () => GLYPHS[Math.floor(rnd() * GLYPHS.length)]).join("\n");
      return {
        key: i,
        text,
        left: `${((i + 0.5) / columns) * 100}%`,
        fontSize: `${13 + Math.floor(rnd() * 6)}px`,
        opacity: +(0.28 + rnd() * 0.5).toFixed(2),
        animationDuration: `${(5.5 + rnd() * 10).toFixed(2)}s`,
        animationDelay: `${(-rnd() * 16).toFixed(2)}s`,
      };
    });
  }, [columns, seed]);

  return (
    <div className={styles.matrixRainWrap} aria-hidden="true">
      {cols.map(({ key, text, ...style }) => (
        <span key={key} className={styles.matrixCol} style={style}>{text}</span>
      ))}
    </div>
  );
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
            <span className={styles.compactMatrixLabel} aria-hidden="true">PREMIERA</span>
            <span className={styles.compactMatrixCountdown}>1.01.2027</span>
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
          <ComingSoonScene
            isPl={isPl}
            reduceMotion={Boolean(reduceMotion)}
            titleId={titleId}
            units={units}
            countdownLabel={countdownLabel}
            target={PATRON_COMING_SOON_TARGET}
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
  units,
  countdownLabel,
  target,
}: {
  isPl: boolean;
  reduceMotion: boolean;
  titleId: string;
  units: string[];
  countdownLabel: string;
  target: Date;
}) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dateLabel = `${target.getFullYear()}.${pad2(target.getMonth() + 1)}.${pad2(target.getDate())}`;
  const unitLabels = isPl ? ["DNI", "GODZ", "MIN", "SEK"] : ["DAYS", "HRS", "MIN", "SEC"];

  return (
    <>
      {!reduceMotion && <MatrixRain columns={28} />}

      <div className={styles.matrixVignette} aria-hidden="true" />
      <div className={styles.matrixScanlines} aria-hidden="true" />

      <header className={styles.matrixTopBar} aria-hidden="true">
        <span className={styles.matrixBadge}>
          {isPl ? "> połączenie ustanowione" : "> connection established"}
          <span className={styles.matrixBlink}> █</span>
        </span>
      </header>

      <div className={styles.matrixContent}>
        <span className={styles.matrixKicker} aria-hidden="true">
          // {isPl ? "inicjalizacja systemu" : "system initializing"}
        </span>

        <motion.h2
          id={titleId}
          className={styles.matrixHeading}
          initial={reduceMotion ? false : { opacity: 0, filter: "blur(6px)", letterSpacing: "0.35em" }}
          animate={{ opacity: 1, filter: "blur(0px)", letterSpacing: "0.12em" }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
        >
          {isPl ? "JUŻ WKRÓTCE" : "COMING SOON"}
        </motion.h2>

        <motion.span
          className={styles.matrixLine}
          aria-hidden="true"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.3 }}
        />

        <motion.div
          className={styles.matrixUnits}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.55 }}
          aria-label={countdownLabel}
        >
          {units.map((val, i) => (
            <span key={i} className={styles.matrixUnitWrap} aria-hidden="true">
              <span className={styles.matrixUnit}>
                <span className={styles.matrixUnitValue}>{val}</span>
                <span className={styles.matrixUnitLabel}>{unitLabels[i]}</span>
              </span>
              {i < units.length - 1 && <span className={styles.matrixSep}>:</span>}
            </span>
          ))}
        </motion.div>
      </div>

      <footer className={styles.matrixBottomBar} aria-hidden="true">
        <span>&gt; T-MINUS // {dateLabel}</span>
        <span>STATUS: <span className={styles.matrixAccent}>{isPl ? "ŁADOWANIE" : "LOADING"}</span></span>
      </footer>
    </>
  );
}

export default AccessLockOverlay;
