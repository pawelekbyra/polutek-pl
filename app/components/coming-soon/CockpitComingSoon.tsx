"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { formatPremiereDate } from "@/lib/temp-patron-coming-soon";
import styles from "./CockpitComingSoon.module.css";

type Star = { x: number; y: number; z: number; tint: string };

const EASE = [0.2, 0.7, 0.2, 1] as const;

const TINTS = ["255,255,255", "255,255,255", "255,255,255", "255,255,255", "205,225,255", "205,225,255", "255,228,196"];

function Warpfield({ still }: { still: boolean }) {
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
    let t = 0;
    let visible = true;

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
      if (!visible) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      t += dt;

      // Slow throttle surges so the flight breathes instead of running at a flat speed.
      const surge = 0.5 + 0.5 * Math.sin(t * 0.32) * Math.sin(t * 0.11 + 1.3);
      const speed = 0.12 + surge * 0.16;

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

    if (still) {
      draw();
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
    });
    io.observe(canvas);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [still]);

  return <canvas ref={canvasRef} className={styles.warp} aria-hidden="true" />;
}

const LOG_LINES = {
  pl: ["kurs ustalony: PREMIERA", "napęd nadświetlny stabilny", "osłony: 100%", "transmisja w przygotowaniu", "cel namierzony"],
  en: ["course locked: PREMIERE", "hyperdrive stable", "shields: 100%", "transmission in preparation", "target acquired"],
};

function FlightLog({ isPl, still }: { isPl: boolean; still: boolean }) {
  const lines = LOG_LINES[isPl ? "pl" : "en"];
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(still ? Infinity : 0);

  useEffect(() => {
    if (still) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % lines.length);
      setTyped(0);
    }, 3400);
    return () => clearInterval(id);
  }, [still, lines.length]);

  const line = lines[index];

  // Typed in JS rather than a CSS width animation: the HUD font is proportional.
  useEffect(() => {
    if (still || typed >= line.length) return;
    const id = setTimeout(() => setTyped((n) => n + 1), 38);
    return () => clearTimeout(id);
  }, [still, typed, line.length]);

  return (
    <div className={styles.log} aria-hidden="true">
      <span className={styles.logPrompt}>&gt;</span>
      <span className={styles.logLine}>{line.slice(0, typed)}</span>
      <span className={styles.caret}>▍</span>
    </div>
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
  const unitLabels = isPl ? ["DNI", "GODZ", "MIN", "SEK"] : ["DAYS", "HRS", "MIN", "SEC"];
  const premiereDate = formatPremiereDate();
  const enter = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } };

  return (
    <div className={styles.cockpit}>
      <div className={styles.nebula} aria-hidden="true" />
      <Warpfield still={reduceMotion} />
      <div className={styles.focus} aria-hidden="true" />
      <div className={styles.glass} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <span className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTr}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />

      <div className={styles.content}>
        <motion.span className={styles.date} {...enter(0.1)}>
          {premiereDate}
        </motion.span>

        <motion.h2
          id={titleId}
          className={styles.heading}
          {...(reduceMotion
            ? { initial: false, transition: { duration: 0 } }
            : {
                initial: { opacity: 0, letterSpacing: "0.6em", filter: "blur(8px)" },
                animate: { opacity: 1, letterSpacing: "0.2em", filter: "blur(0px)" },
                transition: { duration: 1.1, delay: 0.2, ease: EASE },
              })}
        >
          {isPl ? "PREMIERA" : "PREMIERE"}
        </motion.h2>

        <motion.div
          className={styles.horizon}
          aria-hidden="true"
          {...(reduceMotion
            ? { initial: false, transition: { duration: 0 } }
            : { initial: { opacity: 0, scaleX: 0 }, animate: { opacity: 1, scaleX: 1 }, transition: { duration: 0.8, delay: 0.5 } })}
        >
          <span className={styles.horizonLine} />
          <span className={styles.marker}>
            <span className={styles.markerWing} />
            <span className={styles.markerBody} />
            <span className={styles.markerWing} />
          </span>
          <span className={styles.horizonLine} />
        </motion.div>

        <motion.div className={styles.units} role="timer" aria-label={countdownLabel} {...enter(0.75)}>
          <span className={styles.tMinus} aria-hidden="true">T−</span>
          {units.map((value, i) => (
            <span key={unitLabels[i]} className={styles.unitGroup} aria-hidden="true">
              {i > 0 && <span className={styles.sep}>:</span>}
              <span className={styles.unit}>
                <span className={styles.unitValue}>{value}</span>
                <span className={styles.unitLabel}>{unitLabels[i]}</span>
              </span>
            </span>
          ))}
        </motion.div>
      </div>

      <FlightLog isPl={isPl} still={reduceMotion} />
    </div>
  );
}
