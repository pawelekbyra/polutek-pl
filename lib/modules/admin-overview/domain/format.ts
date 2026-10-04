/**
 * Polish formatting for the panel (pl-PL, Europe/Warsaw). Shared by the read models (detail strings)
 * and the screens, so a number reads the same everywhere. Pure, the clock is a parameter.
 */
import { PANEL_TIME_ZONE, warsawDayKey } from "./time";

const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dfTime = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: PANEL_TIME_ZONE });
const dfDate = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: PANEL_TIME_ZONE });
const dfDateY = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone: PANEL_TIME_ZONE });
const dfWeekday = new Intl.DateTimeFormat("pl-PL", { weekday: "short", timeZone: PANEL_TIME_ZONE });
const dfLong = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: PANEL_TIME_ZONE });

export const fmtInt = (v: number) => nf0.format(Math.round(v));
export const fmtOne = (v: number) => nf1.format(v);
export const fmtPln = (v: number) => `${nf0.format(Math.round(v))} zł`;
export const fmtMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
export const fmtTime = (d: Date | string) => dfTime.format(new Date(d));
export const fmtDate = (d: Date | string) => dfDate.format(new Date(d));
export const fmtDateY = (d: Date | string) => dfDateY.format(new Date(d));
export const fmtLongDay = (d: Date | string) => {
  const s = dfLong.format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "dziś", "wczoraj", "pt. 2 paź" relative to `now`. */
export function fmtDay(d: Date | string, now: Date): string {
  const date = new Date(d);
  const key = warsawDayKey(date);
  if (key === warsawDayKey(now)) return "dziś";
  if (key === warsawDayKey(new Date(now.getTime() - 86_400_000))) return "wczoraj";
  if (key === warsawDayKey(new Date(now.getTime() + 86_400_000))) return "jutro";
  return `${dfWeekday.format(date)} ${dfDate.format(date)}`;
}

export const fmtDateTime = (d: Date | string, now: Date) => `${fmtDay(d, now)}, ${fmtTime(d)}`;

/** "przed chwilą", "5 min temu", "2 h 10 min temu", "za 3 d 4 h". */
export function fmtRelative(d: Date | string, now: Date): string {
  const s = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  const a = Math.abs(s);
  const future = s < 0;
  if (a < 60) return future ? "za chwilę" : "przed chwilą";
  let t: string;
  if (a < 3600) t = `${Math.round(a / 60)} min`;
  else if (a < 86400) {
    const h = Math.floor(a / 3600);
    const m = Math.round((a % 3600) / 60);
    t = h < 10 && m >= 1 ? `${h} h ${m} min` : `${h} h`;
  } else {
    const days = Math.floor(a / 86400);
    const h = Math.floor((a % 86400) / 3600);
    t = days < 10 && h >= 1 ? `${days} d ${h} h` : `${days} d`;
  }
  return future ? `za ${t}` : `${t} temu`;
}

const UNITS = ["B", "KB", "MB", "GB", "TB"];
export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i >= 3 ? fmtOne(v) : fmtInt(v)} ${UNITS[i]}`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

export function fmtPercent(v: number, digits = 0): string {
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: digits }).format(v)}%`;
}

/** Delta between two totals as the tile shows it; null when there is nothing to compare with. */
export function deltaOf(current: number, previous: number | null, upIsGood = true) {
  if (previous === null || !Number.isFinite(previous) || previous === 0) return null;
  const pct = (current / previous - 1) * 100;
  const flat = Math.abs(pct) < 1;
  const tone: "good" | "bad" | "flat" = flat ? "flat" : pct > 0 === upIsGood ? "good" : "bad";
  const direction: "up" | "down" | "flat" = flat ? "flat" : pct > 0 ? "up" : "down";
  const text = flat ? "0%" : fmtPercent(Math.abs(pct));
  const spoken = flat ? "bez zmian" : `${pct > 0 ? "wzrost" : "spadek"} o ${fmtPercent(Math.abs(pct))}${tone === "bad" ? " (niekorzystnie)" : " (korzystnie)"}`;
  return { pct, tone, direction, text, spoken };
}
