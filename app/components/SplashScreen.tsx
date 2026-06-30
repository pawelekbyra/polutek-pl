"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "skip" | "showing" | "ready" | "exiting" | "done";

const PAPER = "#f7f1e4";
const INK = "#121212";
const INK_FAINT = "rgba(18,18,18,0.13)";
const FONT = "var(--font-patrick, 'Patrick Hand', cursive)";
const MIN_MS = 1600;

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
  const inkColor = isReady ? INK : "rgba(18,18,18,0.35)";

  // Reduced motion: skip all animations, show ENTER immediately active
  if (reduced) {
    return (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <button onClick={handleEnter} style={{ fontFamily: FONT, fontSize: 22, letterSpacing: 10, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, padding: "24px 48px", background: "transparent", cursor: "pointer" }}>
          ENTER
        </button>
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
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>

            {/* Handwritten text */}
            <motion.div
              style={{ marginBottom: 28, textAlign: "center", overflow: "hidden" }}
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 0.8, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <span style={{ fontFamily: FONT, fontSize: "clamp(17px, 3.5vw, 26px)", color: INK, lineHeight: 1.3 }}>
                Nie masz psychy se tu kliknąć
              </span>
            </motion.div>

            {/* Hand-drawn arrow (SVG path draw-on) */}
            <motion.svg
              width="56" height="72" viewBox="0 0 56 72"
              style={{ marginBottom: 12 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.05 }}
            >
              {/* Arrow shaft */}
              <motion.path
                d="M 30 2 C 28 14, 26 28, 24 44 C 23 52, 21 60, 20 68"
                fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 1.1, ease: "easeInOut" }}
              />
              {/* Arrow head left */}
              <motion.path
                d="M 20 68 L 10 56"
                fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22, delay: 1.62, ease: "easeOut" }}
              />
              {/* Arrow head right */}
              <motion.path
                d="M 20 68 L 32 58"
                fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22, delay: 1.62, ease: "easeOut" }}
              />
            </motion.svg>

            {/* ENTER button */}
            <motion.button
              onClick={handleEnter}
              disabled={!isReady}
              animate={isReady ? {
                scale: [1, 0.96, 1.03, 1],
                transition: { duration: 0.45, ease: "easeOut", delay: 0.05 }
              } : {}}
              whileHover={isReady ? { scale: 1.03 } : {}}
              whileTap={isReady ? { scale: 0.97 } : {}}
              style={{
                position: "relative",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: isReady ? "pointer" : "default",
                outline: "none",
                width: 240,
                height: 80,
              }}
            >
              {/* Hand-drawn border — draws itself edge by edge */}
              <svg width="240" height="80" viewBox="0 0 240 80" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {/* Top */}
                <motion.path d="M 10 12 C 70 9, 150 7, 215 10 C 228 11, 234 10, 234 11"
                  fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.38, delay: 1.82, ease: "easeOut" }}
                  style={{ transition: "stroke 0.3s ease" }}
                />
                {/* Right */}
                <motion.path d="M 233 11 C 235 28, 236 52, 234 66 C 234 71, 233 70, 233 70"
                  fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.22, delay: 2.2, ease: "easeOut" }}
                  style={{ transition: "stroke 0.3s ease" }}
                />
                {/* Bottom */}
                <motion.path d="M 234 69 C 180 72, 100 74, 30 71 C 16 70, 8 71, 7 70"
                  fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.38, delay: 2.42, ease: "easeOut" }}
                  style={{ transition: "stroke 0.3s ease" }}
                />
                {/* Left */}
                <motion.path d="M 8 70 C 6 55, 7 32, 8 18 C 8 14, 10 12, 10 12"
                  fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.22, delay: 2.8, ease: "easeOut" }}
                  style={{ transition: "stroke 0.3s ease" }}
                />
              </svg>

              {/* ENTER text */}
              <motion.span
                style={{
                  display: "block", width: "100%", height: "100%",
                  lineHeight: "80px", textAlign: "center",
                  fontFamily: FONT, fontSize: 20, letterSpacing: 10,
                  color: inkColor, userSelect: "none",
                  transition: "color 0.35s ease",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.9 }}
              >
                ENTER
              </motion.span>
            </motion.button>
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

          {/* Logo signature */}
          <motion.div
            style={{
              position: "absolute", bottom: 20, right: 20,
              fontFamily: FONT, fontSize: 13, letterSpacing: "0.01em",
              userSelect: "none", display: "flex", alignItems: "baseline",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <span style={{ color: INK, fontWeight: 700, textTransform: "uppercase" }}>POLUTEK</span>
            <span style={{ color: "#2563eb", fontWeight: 700, textTransform: "uppercase" }}>.PL</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
