import { intlLocale, type Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
/**
 * Client-safe premiere helpers (see CLAUDE.md "Premieres"). The upcoming
 * check lives in the video domain; it is re-exported here so client
 * components don't pull the whole `@/lib/modules/video` barrel (server code)
 * into the browser bundle.
 */
export { isUpcomingPremiere, toPremiereDate } from "@/lib/modules/video/domain/premiere";
export type { PremiereCandidate } from "@/lib/modules/video/domain/premiere";

const PREMIERE_TIME_ZONE = "Europe/Warsaw";

/**
 * The premiere date as shown on the segment display, always in Europe/Warsaw. Polish keeps the day-first "1.01.2027";
 * every other language gets the year-first "2027.01.01", which cannot be read as month-first ("3.07.2027" was 7 March
 * for an American and 3 July for everyone else) and uses only the digits and dots the display font draws.
 */
export function formatPremiereDate(target: Date, language: Locale = "pl"): string {
  if (language === "pl") {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: PREMIERE_TIME_ZONE,
      day: "numeric",
      month: "2-digit",
      year: "numeric",
    }).format(target);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PREMIERE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(target);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}.${part("month")}.${part("day")}`;
}

/** The same day written out in the viewer's language ("3 July 2027"), for screen readers (the segment display is decoration). */
export function formatPremiereDateLong(target: Date, language: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(language), { timeZone: PREMIERE_TIME_ZONE, dateStyle: "long" }).format(target);
}

/** "PREMIERA ZA 3D 4H 5M 6S" / "PREMIERES IN …", clamped at zero. */
export function formatPremiereCountdown(tx: Tx, target: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return tx("PREMIERA ZA {0}D {1}H {2}M {3}S", "PREMIERES IN {0}D {1}H {2}M {3}S", days, hours, minutes, seconds);
}
