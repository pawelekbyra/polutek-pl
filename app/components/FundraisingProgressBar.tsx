"use client";

import { useEffect, useState } from "react";
import type { Tx } from "@/lib/i18n/ui";

interface FundraisingProgressBarProps {
  /** Share of the goal reached, 0..1 (PublicVideoDTO.fundraisingProgress). */
  progress: number;
  tx: Tx;
}

/** Clamps to 0..100 whole percents; anything non-finite reads as 0. */
export function toProgressPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/**
 * Amount-free fundraising bar under the video title (CLAUDE.md "Fundraising
 * progress bar"): only a filled track, no amounts, currency or visible percent.
 * The fill grows in once on mount (not under reduced motion).
 */
export function FundraisingProgressBar({ progress, tx }: FundraisingProgressBarProps) {
  const percent = toProgressPercent(progress);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role="progressbar"
      aria-label={tx("Postęp zbiórki", "Fundraising progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-testid="fundraising-progress"
      className="relative h-[7px] w-full overflow-hidden rounded-full bg-[var(--chan-surface)] shadow-[inset_0_0_0_1px_var(--chan-line-soft)]"
    >
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,color-mix(in_srgb,var(--chan-blue)_78%,black),var(--chan-blue)_55%,color-mix(in_srgb,var(--chan-blue)_70%,white))] shadow-[0_0_10px_-2px_var(--chan-blue)] motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
        style={{ width: `${shown ? percent : 0}%` }}
      />
    </div>
  );
}
