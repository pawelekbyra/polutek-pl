"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { formatPremiereDate } from "@/lib/temp-patron-coming-soon";
import styles from "./CockpitComingSoon.module.css";

type Star = { x: number; y: number; z: number; tint: string };

const EASE = [0.2, 0.7, 0.2, 1] as const;

const TINTS = ["255,255,255", "255,255,255", "255,255,255", "255,255,255", "205,225,255", "205,225,255", "255,228,196"];

function Warpfield({ still, readoutRef }: { still: boolean; readoutRef: React.RefObject<HTMLSpanElement | null> }) {
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
    let lastReadout = 0;
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

    const draw = (speed: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const s = Math.max(w, h) / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      for (const star of stars) {
        const sx = cx + (star.x / star.z) * s;
        const sy = cy + (star.y / star.z) * s;
        const tailZ = Math.min(1, star.z + speed * 0.18);
        const px = cx + (star.x / tailZ) * s;
        const py = cy + (star.y / tailZ) * s;
        const near = 1 - star.z;
        const alpha = Math.min(1, near * 1.35);
        const width = 0.35 + near * near * 2.6;

        ctx.strokeStyle = `rgba(${star.tint},${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        if (star.z < 0.22) {
          ctx.fillStyle = `rgba(${star.tint},${alpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(sx, sy, width * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
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
      draw(speed);

      if (readoutRef.current && now - lastReadout > 140) {
        lastReadout = now;
        readoutRef.current.textContent = (1.5 + speed * 12).toFixed(2);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (still) {
      draw(0.05);
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
  }, [still, readoutRef]);

  return <canvas ref={canvasRef} className={styles.warp} aria-hidden="true" />;
}

function HudRing() {
  const ticks = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2;
        const major = i % 6 === 0;
        const r1 = major ? 88 : 92;
        return {
          key: i,
          x1: 100 + Math.cos(a) * r1,
          y1: 100 + Math.sin(a) * r1,
          x2: 100 + Math.cos(a) * 97,
          y2: 100 + Math.sin(a) * 97,
          major,
        };
      }),
    [],
  );

  return (
    <div className={styles.ring} aria-hidden="true">
      <svg viewBox="0 0 200 200" className={styles.ringOuter}>
        <circle cx="100" cy="100" r="97" />
        {ticks.map(({ key, major, ...line }) => (
          <line key={key} {...line} className={major ? styles.tickMajor : undefined} />
        ))}
      </svg>
      <svg viewBox="0 0 200 200" className={styles.ringInner}>
        <circle cx="100" cy="100" r="78" strokeDasharray="2 6" />
        <path d="M100 14 L104 22 L96 22 Z" className={styles.ringPointer} />
      </svg>
    </div>
  );
}

const LOG_LINES = {
  pl: ["kurs ustalony: PREMIERA", "napęd nadświetlny stabilny", "osłony: 100%", "transmisja w przygotowaniu", "cel namierzony"],
  en: ["course locked: PREMIERE", "hyperdrive stable", "shields: 100%", "transmission in preparation", "target acquired"],
};

function FlightLog({ isPl, still }: { isPl: boolean; still: boolean }) {
  const lines = LOG_LINES[isPl ? "pl" : "en"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % lines.length), 3400);
    return () => clearInterval(id);
  }, [still, lines.length]);

  const line = lines[index];
  return (
    <span className={styles.log}>
      <span className={styles.logPrompt}>&gt;</span>
      <span key={`${isPl}-${index}`} className={styles.logLine} style={{ "--len": line.length } as React.CSSProperties}>
        {line}
      </span>
      <span className={styles.caret}>▍</span>
    </span>
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
  const readoutRef = useRef<HTMLSpanElement>(null);
  const unitLabels = isPl ? ["DNI", "GODZ", "MIN", "SEK"] : ["DAYS", "HRS", "MIN", "SEC"];
  const premiereDate = formatPremiereDate();
  const enter = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } };

  return (
    <div className={styles.cockpit}>
      <div className={styles.nebula} aria-hidden="true" />
      <Warpfield still={reduceMotion} readoutRef={readoutRef} />
      <div className={styles.focus} aria-hidden="true" />
      <HudRing />
      <div className={styles.glass} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <span className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTr}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />

      <header className={styles.topBar} aria-hidden="true">
        <span>
          NAV-COMP <span className={styles.dim}>//</span> {isPl ? "KURS" : "HEADING"}:{" "}
          <span className={styles.accent}>{isPl ? "PREMIERA" : "PREMIERE"}</span>
        </span>
        <span className={styles.status}>
          <span className={styles.statusDot} />
          SYS ONLINE
        </span>
      </header>

      <div className={`${styles.tape} ${styles.tapeLeft}`} aria-hidden="true">
        <span className={styles.tapeScale} />
        <span className={styles.tapeReadout}>
          <span className={styles.tapeLabel}>WARP</span>
          <span ref={readoutRef} className={styles.tapeValue}>3.20</span>
        </span>
      </div>
      <div className={`${styles.tape} ${styles.tapeRight}`} aria-hidden="true">
        <span className={`${styles.tapeScale} ${styles.tapeScaleUp}`} />
        <span className={styles.tapeReadout}>
          <span className={styles.tapeLabel}>{isPl ? "CEL" : "TARGET"}</span>
          <span className={`${styles.tapeValue} ${styles.lock}`}>LOCK</span>
        </span>
      </div>

      <div className={styles.content}>
        <motion.span className={styles.kicker} aria-hidden="true" {...enter(0.1)}>
          {isPl ? "// transmisja przychodząca" : "// incoming transmission"}
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
          {isPl ? "JUŻ WKRÓTCE" : "COMING SOON"}
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
          {units.map((value, i) => (
            <span key={unitLabels[i]} className={styles.unit} aria-hidden="true">
              <span key={reduceMotion ? "static" : value} className={styles.unitValue}>
                {value}
              </span>
              <span className={styles.unitLabel}>{unitLabels[i]}</span>
            </span>
          ))}
        </motion.div>
      </div>

      <footer className={styles.bottomBar} aria-hidden="true">
        <FlightLog isPl={isPl} still={reduceMotion} />
        <span>
          ETA <span className={styles.dim}>//</span> <span className={styles.accent}>{premiereDate}</span>{" "}
          <span className={styles.dim}>00:00</span>
        </span>
      </footer>
    </div>
  );
}
