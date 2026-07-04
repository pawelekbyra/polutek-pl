"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// Shared motion pieces for the comments section. Global MotionConfig (reducedMotion="user")
// already disables these for users who prefer reduced motion.

/** Spring used when a comment "lands" in the list after posting. */
export const commentLandSpring = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.9 };

export const commentEnterInitial = { opacity: 0, y: -14, scale: 0.975 };
export const commentEnterAnimate = { opacity: 1, y: 0, scale: 1 };
export const commentExit = { opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.18 } };

/**
 * Wraps one top-level comment (with its replies) so it animates in when posted, animates out
 * when deleted, and glides (layout) when the list reorders — e.g. a new comment landing on top.
 */
export function CommentMotionItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      layout="position"
      initial={commentEnterInitial}
      animate={commentEnterAnimate}
      exit={commentExit}
      transition={commentLandSpring}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Number that animates on change: the old value slides up and out while the new one slides in
 * from below — used for the comments-count header and per-comment like counts.
 */
export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-grid", overflow: "hidden", verticalAlign: "bottom" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "0.9em", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-0.9em", opacity: 0 }}
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
          style={{ gridArea: "1 / 1", display: "inline-block" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Pops the like icon with a springy overshoot whenever the viewer's like lands. */
export function LikePop({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <motion.span
      className="inline-flex"
      animate={active ? { scale: [1, 1.4, 0.92, 1], rotate: [0, -10, 5, 0] } : { scale: 1, rotate: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.span>
  );
}
