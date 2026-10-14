/** Pure formatting and sorting helpers of the Studio analytics screens (no React, unit tested). */

export type SortKey = "title" | "views" | "watchSeconds" | "avgPctViewed" | "comments" | "likes";
export type SortDir = "asc" | "desc";

/** "1 h 05 min", "12 min", "45 s": compact watch time that stays readable from seconds to hundreds of hours. */
export function formatWatchTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")} min`;
}

export function formatPercent(value: number | null, locale: string): string | null {
  if (value === null) return null;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

/** Signed change: "+12", "-3", "0". */
export function formatDelta(value: number, locale: string): string {
  const n = new Intl.NumberFormat(locale).format(Math.abs(value));
  return value > 0 ? `+${n}` : value < 0 ? `-${n}` : n;
}

/** "14.10" style label of a `YYYY-MM-DD` day (UTC, no timezone drift). */
export function formatDay(day: string, locale: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/** Date and hour (UTC) of `generatedAt` for the "Data as of" label. */
export function formatDataTime(iso: string, locale: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  return {
    date: d.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
  };
}

/** A y-axis maximum that is a "nice" number above the data (1, 2, 5 times a power of ten); never 0. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * Sorts table rows without mutating them. A withheld average (null) sorts last in both directions, so "not enough
 * data" never looks like the best or worst video.
 */
export function sortRows<T extends Record<SortKey, unknown>>(rows: readonly T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "string" && typeof bv === "string") return sign * av.localeCompare(bv);
    return sign * (Number(av) - Number(bv));
  });
}
