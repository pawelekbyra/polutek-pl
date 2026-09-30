"use client";

import { useEffect, useState } from "react";
import { toPremiereDate } from "@/lib/premiere";

// setTimeout overflows above 2^31-1 ms (~24.8 days); re-arm in chunks.
const MAX_TIMER_MS = 2_147_000_000;

/**
 * A "now" that only changes when one of the given premieres is reached
 * (CLAUDE.md "Premieres"). Components compute `isUpcomingPremiere(x, now)`
 * with it, so a video flips from "coming soon" to playable on an open page
 * at the exact premiere time without polling or a reload.
 */
export function usePremiereClock(targets: ReadonlyArray<Date | string | null | undefined>): Date {
  const [now, setNow] = useState(() => new Date());
  // Stable dependency: the list of target times, not the array identity.
  const key = targets
    .map((target) => toPremiereDate(target)?.getTime())
    .filter((time): time is number => typeof time === "number")
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    const times = key ? key.split(",").map(Number) : [];
    const current = Date.now();
    const next = times.find((time) => time > current);
    if (next === undefined) return;
    const timer = setTimeout(() => setNow(new Date()), Math.min(next - current + 50, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [key, now]);

  return now;
}
