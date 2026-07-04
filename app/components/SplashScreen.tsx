"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Frame, INK as FRAME_INK } from "./najs/primitives";
import { enterGlyphFilledPath, APP_ICON_BLUE } from "@/lib/icons/app-icon";

type Phase = "skip" | "showing" | "ready" | "exiting" | "done";

const PAPER = "#f7f1e4";
const INK = "#121212";
const INK_FAINT = "rgba(18,18,18,0.13)";
const FONT = "var(--font-patrick, 'Patrick Hand', cursive)";
const MIN_MS = 1600;

// The enter mark shown dead-centre on the splash. It is the *same* rounded-square +
// filled blue Enter (↵) glyph the OS launch icon renders (app/icon.tsx, app/icon-512,
// public/icon-enter.svg — all fed by enterGlyphFilledPath), drawn at the same spot with
// no entrance animation. That is what makes the native PWA splash hand off to this screen
// as one continuous image: same background, same centred mark, same shape.
const MARK_SIZE = 128;

function EnterMark({ active }: { active: boolean }) {
  const enter = enterGlyphFilledPath(MARK_SIZE);
  // Before the app is ready the mark is a muted blue; once you can click, it lights up to the
  // full brand blue with a bold ink outline (matching the reference Enter-key button).
  const fill = active ? APP_ICON_BLUE : "rgba(37,99,235,0.32)";
  const stroke = active ? INK : "rgba(18,18,18,0.4)";
  return (
    <div style={{ position: "relative", width: MARK_SIZE, height: MARK_SIZE }}>
      <Frame radius={26} seed={7} stroke={FRAME_INK} strokeWidth={4.5} fill={PAPER} />
      <svg
        width={MARK_SIZE}
        height={MARK_SIZE}
        viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <path
          d={enter.path}
          fill={fill}
          stroke={stroke}
          strokeWidth={enter.strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: "fill 0.35s ease, stroke 0.35s ease" }}
        />
      </svg>
    </div>
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
    // Min time gate
    const minTimer = setTimeout(() => setMinPassed(true), MIN_MS);

    const hardFallback = setTimeout(() => setAppReady(true), 7000);
    const onPreloadProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ progress?: number; ready?: boolean }>).detail;
      if (typeof detail?.progress === "number") {
        setProgress(Math.max(0, Math.min(100, Math.round(detail.progress))));
      }
      if (detail?.ready) setAppReady(true);
    };
    window.addEventListener("polutek:app-preload-progress", onPreloadProgress);

    // Advance gently while the real app preloader reports concrete milestones.
    let prog = 0;
    intervalRef.current = setInterval(() => {
      prog += Math.random() * 3 + 1;
      if (prog >= 88) {
        clearInterval(intervalRef.current!);
        setProgress((current) => Math.max(current, 88));
      } else {
        setProgress((current) => Math.max(current, Math.round(prog)));
      }
    }, 180);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(hardFallback);
      window.removeEventListener("polutek:app-preload-progress", onPreloadProgress);
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
    setPhase("exiting");
    setTimeout(() => setPhase("done"), 500);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready") return;
    const timer = setTimeout(() => handleEnter(), 280);
    return () => clearTimeout(timer);
  }, [handleEnter, phase]);

  if (phase === "skip" || phase === "done") return null;

  const isReady = phase === "ready";
  const isExiting = phase === "exiting";

  // Reduced motion: no animation, mark active immediately, dead-centre.
  if (reduced) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: PAPER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={handleEnter} aria-label="Enter" style={{ position: "relative", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
          <SplashText />
          <EnterMark active={true} />
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="splash"
          style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: PAPER, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
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

          {/* The centred Enter mark IS the button — kept at the exact screen centre so it
              lines up with the native splash icon it hands off from. The prompt text is
              positioned above it and does not shift the mark off-centre. */}
          <motion.button
            onClick={handleEnter}
            disabled={!isReady}
            aria-label="Enter"
            animate={isReady ? { scale: [1, 0.95, 1.04, 1], transition: { duration: 0.5, ease: "easeOut", delay: 0.05 } } : {}}
            whileHover={isReady ? { scale: 1.04 } : {}}
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
            {/* Prompt text — above the mark, appearing only once you can actually click */}
            <motion.div
              style={{
                position: "absolute", bottom: "calc(100% + 26px)", left: "50%",
                transform: "translateX(-50%)", whiteSpace: "nowrap", textAlign: "center",
                overflow: "hidden",
              }}
              initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
              animate={isReady ? { opacity: 1, clipPath: "inset(0 0% 0 0)" } : { opacity: 0, clipPath: "inset(0 100% 0 0)" }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <span style={{ fontFamily: FONT, fontSize: "clamp(17px, 4.4vw, 24px)", color: INK, lineHeight: 1.3 }}>
                Nie masz psychy se tu kliknąć
              </span>
            </motion.div>

            <EnterMark active={isReady} />

            {/* "kliknij" hint under the mark once ready */}
            <motion.span
              style={{
                position: "absolute", top: "calc(100% + 16px)", left: "50%",
                transform: "translateX(-50%)", whiteSpace: "nowrap",
                fontFamily: FONT, fontSize: 13, letterSpacing: 8, color: INK, userSelect: "none",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: isReady ? 0.75 : 0 }}
              transition={{ duration: 0.4 }}
            >
              ENTER
            </motion.span>
          </motion.button>

          {/* Loading bar — pencil line across bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: INK_FAINT }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: APP_ICON_BLUE,
              opacity: 0.55,
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

// Static prompt text for the reduced-motion branch.
function SplashText() {
  return (
    <div style={{ position: "absolute", bottom: "calc(100% + 26px)", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: FONT, fontSize: "clamp(17px, 4.4vw, 24px)", color: INK, lineHeight: 1.3 }}>
        Nie masz psychy se tu kliknąć
      </span>
    </div>
  );
}
