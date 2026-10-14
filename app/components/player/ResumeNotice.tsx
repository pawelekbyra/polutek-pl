"use client";

import { useEffect } from "react";
import { formatClock } from "@/lib/video-start-time";
import { usePlayerCopy } from "./polutek-controls-copy";
import type { StartNotice } from "./useVideoProgress";

/** How long the notice stays before it fades on its own. */
const NOTICE_VISIBLE_MS = 8000;

/**
 * "Resumed at 12:34" with a "From the beginning" button, shown over the picture's lower left corner
 * after the player jumped to a saved position (or to a `?t=` start). Square corners, no animation
 * that could get in the way: it is a polite status line, not a dialog.
 */
export function ResumeNotice({
  notice,
  onStartOver,
  onDismiss,
}: {
  notice: StartNotice | null;
  onStartOver: () => void;
  onDismiss: () => void;
}) {
  const copy = usePlayerCopy();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, NOTICE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  const label = notice.source === "link" ? copy.startsAt : copy.resumedAt;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute bottom-16 left-0 z-40 flex max-w-full items-center gap-3 rounded-none bg-black/85 px-3 py-2 text-[13px] leading-tight text-white"
    >
      <span>
        {label} <span className="font-bold tabular-nums">{formatClock(notice.seconds)}</span>
      </span>
      <button
        type="button"
        onClick={onStartOver}
        className="rounded-none border border-white/60 px-2 py-1 text-[12px] font-bold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        {copy.startOver}
      </button>
    </div>
  );
}
