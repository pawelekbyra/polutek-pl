"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { formatPremiereDate } from "@/lib/temp-patron-coming-soon";
import styles from "./CockpitComingSoon.module.css";
import { PremieraLettering } from "./PremieraLettering";
import { HudBackdrop } from "./HudBackdrop";
import { engineAt } from "./cockpit-timeline";
import { activeProgress, cuesOf, lastIndex, sinceLast, useClockValue, useCockpitClock, type CockpitClock } from "./useCockpitClock";

type Star = { x: number; y: number; z: number; tint: string };

const EASE = [0.2, 0.7, 0.2, 1] as const;

const TINTS = ["255,255,255", "255,255,255", "255,255,255", "255,255,255", "205,225,255", "205,225,255", "255,228,196"];

function Warpfield({ clock, running }: { clock: CockpitClock; running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;
    let last = 0;

    const spawn = (star: Star, z: number) => {
      const s = Math.max(w, h) / 2;
      star.x = (Math.random() * 2 - 1) * (w / 2 / s);
      star.y = (Math.random() * 2 - 1) * (h / 2 / s);
      star.z = z;
      star.tint = TINTS[Math.floor(Math.random() * TINTS.length)];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(700, Math.max(260, Math.round((w * h) / 800)));
      stars = Array.from({ length: count }, () => {
        const star = { x: 0, y: 0, z: 1, tint: TINTS[0] };
        spawn(star, 0.05 + Math.random() * 0.95);
        return star;
      });
    };

    const draw = () => {
      const cx = w / 2;
      const cy = h / 2;
      const s = Math.max(w, h) / 2;
      ctx.clearRect(0, 0, w, h);

      for (const star of stars) {
        const sx = cx + (star.x / star.z) * s;
        const sy = cy + (star.y / star.z) * s;
        const near = 1 - star.z;
        const alpha = Math.min(1, 0.15 + near * 1.2);
        const radius = 0.4 + near * near * 1.9;

        // Soft halo on the closest stars so they read as light, not flat discs.
        if (star.z < 0.35) {
          ctx.fillStyle = `rgba(${star.tint},${alpha * 0.12})`;
          ctx.beginPath();
          ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${star.tint},${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;

      // Speed follows the engine rumble in the audio, with a surge on each thrust burn.
      const phase = clock.phase();
      const thrust = activeProgress("thrust", phase);
      const speed = 0.09 + engineAt(phase) * 0.14 + (thrust >= 0 ? 0.2 * Math.sin(thrust * Math.PI) : 0);

      for (const star of stars) {
        star.z -= speed * dt;
        const sx = (star.x / Math.max(star.z, 0.0001)) * Math.max(w, h) / 2;
        const sy = (star.y / Math.max(star.z, 0.0001)) * Math.max(w, h) / 2;
        if (star.z <= 0.02 || Math.abs(sx) > w / 2 + 40 || Math.abs(sy) > h / 2 + 40) {
          spawn(star, 0.92 + Math.random() * 0.08);
        }
      }
      draw();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (!running) {
      draw();
      return () => ro.disconnect();
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [clock, running]);

  return <canvas ref={canvasRef} className={styles.warp} aria-hidden="true" />;
}

function Segments({ text, className }: { text: string; className?: string }) {
  return <span className={`${styles.seg} ${className ?? ""}`}>{text}</span>;
}

/* Flight log: each line is written at its sound; the course line is typed on the keystrokes. */
const LOG_SCRIPT: { t: number; pl: string; en: string; keys?: boolean }[] = [
  { t: 0.36, pl: "test systemów…", en: "systems check…" },
  { t: 2.3, pl: "test systemów: OK", en: "systems check: OK" },
  { t: 6.11, pl: "łącze danych: aktywne", en: "data link: active" },
  { t: 7.6, pl: "przeliczanie trajektorii…", en: "recomputing trajectory…" },
  { t: 9.71, pl: "korekta ciągu +2,4%", en: "thrust trim +2.4%" },
  { t: 10.72, pl: "skanowanie sektora…", en: "scanning sector…" },
  { t: 14.15, pl: "CEL NAMIERZONY: PREMIERA", en: "TARGET LOCKED: PREMIERE" },
  { t: 17.86, pl: "kurs ustalony: {date}", en: "course set: {date}", keys: true },
  { t: 22.12, pl: "synchronizacja kursu…", en: "syncing course…" },
  { t: 25.2, pl: "kurs zsynchronizowany", en: "course synced" },
  { t: 27.04, pl: "kontakt radarowy: czysto", en: "radar contact: clear" },
  { t: 35.05, pl: "transmisja z bazy: odebrano", en: "base transmission: received" },
  { t: 37.91, pl: "przeliczanie trajektorii…", en: "recomputing trajectory…" },
];

const TYPE_KEYS = cuesOf("type").length;

function FlightLog({ clock, isPl, date }: { clock: CockpitClock; isPl: boolean; date: string }) {
  const key = useClockValue(clock, (p) => {
    if (p < LOG_SCRIPT[0].t) return `${LOG_SCRIPT.length - 1}|full`;
    let i = 0;
    for (let k = 0; k < LOG_SCRIPT.length; k++) if (LOG_SCRIPT[k].t <= p) i = k;
    if (LOG_SCRIPT[i].keys) return `${i}|k${lastIndex("type", p) + 1}`;
    return `${i}|${Math.floor((p - LOG_SCRIPT[i].t) / 0.032)}`;
  });
  const [iS, nS] = key.split("|");
  const entry = LOG_SCRIPT[Number(iS)];
  const text = (isPl ? entry.pl : entry.en).replace("{date}", date);
  let shown = text;
  if (nS.startsWith("k")) shown = text.slice(0, Math.round((Number(nS.slice(1)) / TYPE_KEYS) * text.length));
  else if (nS !== "full") shown = text.slice(0, Number(nS));
  return (
    <div className={styles.log} aria-hidden="true">
      <span className={styles.logPrompt}>&gt;</span>
      <span className={styles.logLine}>{shown}</span>
      <span className={styles.caret}>▍</span>
    </div>
  );
}

function SoundToggle({ on, audible, onToggle, isPl }: { on: boolean; audible: boolean; onToggle: () => void; isPl: boolean }) {
  const label = isPl ? (on ? "Wycisz dźwięk kokpitu" : "Włącz dźwięk kokpitu") : on ? "Mute cockpit sound" : "Unmute cockpit sound";
  return (
    <button type="button" className={styles.sound} onClick={onToggle} aria-pressed={on} aria-label={label} title={label}>
      <span className={`${styles.soundBars} ${on && audible ? styles.soundLive : ""}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span aria-hidden="true">{isPl ? (on ? "DŹWIĘK WŁ." : "DŹWIĘK WYŁ.") : on ? "SOUND ON" : "SOUND OFF"}</span>
    </button>
  );
}

export function CockpitComingSoon({
  isPl,
  reduceMotion,
  titleId,
  units,
  countdownLabel,
}: {
  isPl: boolean;
  reduceMotion: boolean;
  titleId: string;
  units: string[];
  countdownLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const running = !reduceMotion && visible;
  const { clock, soundOn, setSoundOn, audible } = useCockpitClock({ running, initialPhase: reduceMotion ? 15.2 : 0 });
  const locked = useClockValue(clock, (p) => sinceLast("lock", p) < 0.7);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const unitLabels = isPl ? ["DNI", "GODZ", "MIN", "SEK"] : ["DAYS", "HRS", "MIN", "SEC"];
  const premiereDate = formatPremiereDate();
  const enter = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } };

  return (
    <div ref={rootRef} className={`${styles.cockpit} ${running ? "" : styles.paused}`}>
      <div className={styles.nebula} aria-hidden="true" />
      <Warpfield clock={clock} running={running} />
      <div className={styles.focus} aria-hidden="true" />
      <HudBackdrop clock={clock} isPl={isPl} running={running} />
      <div className={styles.glass} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <span className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTr}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />

      <div className={styles.content}>
        <motion.span className={styles.date} {...enter(0.1)}>
          <Segments text={premiereDate} />
        </motion.span>

        <motion.h2
          id={titleId}
          className={`${styles.heading} ${locked ? styles.headingLock : ""}`}
          {...(reduceMotion
            ? { initial: false, transition: { duration: 0 } }
            : {
                initial: { opacity: 0, filter: "blur(6px)" },
                animate: { opacity: 1, filter: "blur(0px)" },
                transition: { duration: 1.1, delay: 0.2, ease: EASE },
              })}
        >
          <PremieraLettering isPl={isPl} className={styles.headingMark} />
        </motion.h2>

        <motion.div className={styles.units} role="timer" aria-label={countdownLabel} {...enter(0.75)}>
          <span className={styles.tMinus} aria-hidden="true">T−</span>
          {units.map((value, i) => (
            <span key={unitLabels[i]} className={styles.unitGroup} aria-hidden="true">
              {i > 0 && <span className={styles.sep}>:</span>}
              <span className={styles.unit}>
                <Segments text={value} className={styles.unitValue} />
                <span className={styles.unitLabel}>{unitLabels[i]}</span>
              </span>
            </span>
          ))}
        </motion.div>
      </div>

      <FlightLog clock={clock} isPl={isPl} date={premiereDate} />
      {!reduceMotion && <SoundToggle on={soundOn} audible={audible} onToggle={() => setSoundOn(!soundOn)} isPl={isPl} />}
    </div>
  );
}
