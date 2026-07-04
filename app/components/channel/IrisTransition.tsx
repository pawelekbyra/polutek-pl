"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Star-Wars-style iris wipe for switching videos: on click the screen closes to black from the
// edges, and once the next video's screen is in place a hole opens from the centre revealing it.
// Implemented as a full-viewport SVG mask (rect minus animated circle), pointer-events off.

type Phase = "idle" | "closing" | "covered" | "opening";

// viewBox is 100×100 with `slice`, so r=75 comfortably clears the corners (hypot(50,50)≈70.7).
const OPEN_R = 75;
const CLOSE_MS = 340;
const OPEN_MS = 620;
// Never trap the viewer under the cover — force-open even if the content signal never arrives.
const SAFETY_MS = 2200;

export function useIrisTransition() {
  const [phase, setPhase] = useState<Phase>("idle");
  const contentReadyRef = useRef(false);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();

  const clearSafety = () => {
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  };

  const trigger = useCallback(() => {
    if (reduced) return; // respect prefers-reduced-motion: no cinematic wipe
    contentReadyRef.current = false;
    setPhase("closing");
    clearSafety();
    safetyRef.current = setTimeout(() => setPhase("opening"), SAFETY_MS);
  }, [reduced]);

  const contentReady = useCallback(() => {
    contentReadyRef.current = true;
    // If the cover is already fully closed, reveal the new scene now; if it is still closing,
    // onCloseComplete below will open immediately once closed.
    setPhase((current) => (current === "covered" ? "opening" : current));
  }, []);

  const onCloseComplete = useCallback(() => {
    setPhase((current) => {
      if (current !== "closing") return current;
      return contentReadyRef.current ? "opening" : "covered";
    });
  }, []);

  const onOpenComplete = useCallback(() => {
    clearSafety();
    setPhase("idle");
  }, []);

  useEffect(() => clearSafety, []);

  const element =
    phase === "idle" ? null : (
      <svg
        className="pointer-events-none fixed inset-0 z-[9980] h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <mask id="polutek-iris-mask">
            <rect width="100" height="100" fill="white" />
            <motion.circle
              cx="50"
              cy="50"
              fill="black"
              initial={{ r: phase === "closing" ? OPEN_R : 0 }}
              animate={{ r: phase === "closing" || phase === "covered" ? 0 : OPEN_R }}
              transition={
                phase === "opening"
                  ? { duration: OPEN_MS / 1000, ease: [0.22, 1, 0.36, 1] }
                  : { duration: CLOSE_MS / 1000, ease: "easeIn" }
              }
              onAnimationComplete={phase === "closing" ? onCloseComplete : phase === "opening" ? onOpenComplete : undefined}
            />
          </mask>
        </defs>
        <rect width="100" height="100" fill="#121212" mask="url(#polutek-iris-mask)" />
      </svg>
    );

  return { trigger, contentReady, element };
}
