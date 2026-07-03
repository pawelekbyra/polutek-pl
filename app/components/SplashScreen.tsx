"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "skip" | "showing" | "ready" | "exiting" | "done";

const PAPER = "#f7f1e4";
const INK = "#121212";
const INK_FAINT = "rgba(18,18,18,0.13)";
const ENTER_FILL_READY = "#2563eb";
const ENTER_FILL_WAITING = "#dce8ff";
const FONT = "var(--font-patrick, 'Patrick Hand', cursive)";
const MIN_MS = 1600;

// Same centered ENTER mark rendered by app/icon.tsx / app/icon-512 (the OS
// launch icon). It intentionally has no lettermark, so the PWA splash can hand
// off directly into this clickable splash without a visible jump.
function EnterMark({ active = true, size = 156 }: { active?: boolean; size?: number }) {
  const fill = active ? ENTER_FILL_READY : ENTER_FILL_WAITING;
  const stroke = active ? INK : "rgba(18,18,18,0.48)";

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M 108 164 C 107 125, 136 94, 176 94 L 350 94 C 391 94, 421 125, 421 166 L 421 250 C 421 291, 391 322, 350 322 L 270 322 L 270 379 C 270 397, 249 407, 235 395 L 94 279 C 82 269, 82 250, 94 240 L 133 207 C 119 198, 108 183, 108 164 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 173 166 L 347 166 C 361 166, 371 176, 371 190 L 371 231 C 371 245, 361 255, 347 255 L 236 255"
        fill="none"
        stroke={stroke}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.78"
      />
      <path
        d="M 242 222 L 199 258 L 242 294"
        fill="none"
        stroke={stroke}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.78"
      />
      <path
        d="M 123 174 C 149 158, 209 153, 278 155 C 338 157, 386 154, 407 169"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);
  return reduced;
}

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("showing");
  const [progress, setProgress] = useState(0);
  const [appReady, setAppReady] = useState(false);
  const [minPassed, setMinPassed] = useState(false);
  const reduced = useReducedMotion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Skip if already shown this session
    try {
      if (sessionStorage.getItem("polutek_splash")) {
        setPhase("skip");
        return;
      }
    } catch {}

    // Min time gate
    const minTimer = setTimeout(() => setMinPassed(true), MIN_MS);

    // App ready gate
    if (document.readyState === "complete") {
      setAppReady(true);
    } else {
      const onLoad = () => setAppReady(true);
      window.addEventListener("load", onLoad, { once: true });
    }

    // Animate progress to ~80%, then wait for both gates
    let prog = 0;
    intervalRef.current = setInterval(() => {
      prog += Math.random() * 6 + 2;
      if (prog >= 78) {
        clearInterval(intervalRef.current!);
        setProgress(78);
      } else {
        setProgress(Math.round(prog));
      }
    }, 120);

    return () => {
      clearTimeout(minTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Both gates open → activate ENTER
  useEffect(() => {
    if (appReady && minPassed && phase === "showing") {
      setProgress(100);
      setTimeout(() => setPhase("ready"), 350);
    }
  }, [appReady, minPassed, phase]);

  const handleEnter = useCallback(() => {
    if (phase !== "ready") return;
    try { sessionStorage.setItem("polutek_splash", "1"); } catch {}
    setPhase("exiting");
    setTimeout(() => setPhase("done"), 500);
  }, [phase]);

  if (phase === "skip" || phase === "done") return null;

  const isReady = phase === "ready";
  const isExiting = phase === "exiting";
  // Reduced motion: skip all animations, show ENTER immediately active
  if (reduced) {
    return (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <button onClick={handleEnter} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }} aria-label="Wejdź na stronę">
          <EnterMark active size={176} />
        </button>
        <span style={{ marginTop: 18, fontFamily: FONT, fontSize: 26, color: INK, textAlign: "center", lineHeight: 1.1 }}>
          Nie masz psychy se tu kliknąć
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="splash"
          style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
        >
          {/* Grid background */}
          <motion.div
            style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: `linear-gradient(90deg, ${INK_FAINT} 1px, transparent 1px), linear-gradient(${INK_FAINT} 1px, transparent 1px)`,
              backgroundSize: "42px 42px",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          />

          {/* Main content */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(-10px)" }}>
            <motion.button
              onClick={handleEnter}
              disabled={!isReady}
              aria-label="Wejdź na stronę"
              animate={isReady ? {
                scale: [1, 0.97, 1.025, 1],
                transition: { duration: 0.45, ease: "easeOut", delay: 0.05 }
              } : {}}
              whileHover={isReady ? { scale: 1.025 } : {}}
              whileTap={isReady ? { scale: 0.96 } : {}}
              style={{
                position: "relative",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: isReady ? "pointer" : "default",
                outline: "none",
              }}
            >
              <EnterMark active={isReady} size={176} />
            </motion.button>

            <motion.div
              style={{ marginTop: 18, textAlign: "center", maxWidth: 300, padding: "0 18px" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }}
            >
              <span style={{ fontFamily: FONT, fontSize: "clamp(19px, 4.2vw, 29px)", color: INK, lineHeight: 1.1 }}>
                Nie masz psychy se tu kliknąć
              </span>
            </motion.div>
          </div>

          {/* Loading bar — pencil line across bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: INK_FAINT }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: INK,
              opacity: 0.35,
              transition: "width 0.3s ease",
            }} />
          </div>

          {/* POLUTEK.PL signature */}
          <motion.div
            style={{
              position: "absolute", bottom: 20, right: 20,
              fontFamily: FONT, fontSize: 10, letterSpacing: "0.22em",
              color: INK, userSelect: "none",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            POLUTEK.PL
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
