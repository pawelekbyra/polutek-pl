/**
 * Client-safe premiere helpers (see CLAUDE.md "Premieres"). The upcoming
 * check lives in the video domain; it is re-exported here so client
 * components don't pull the whole `@/lib/modules/video` barrel (server code)
 * into the browser bundle.
 */
export { isUpcomingPremiere, toPremiereDate } from "@/lib/modules/video/domain/premiere";
export type { PremiereCandidate } from "@/lib/modules/video/domain/premiere";

/** "1.01.2027" — the premiere date as shown on the HUD, always in Europe/Warsaw. */
export function formatPremiereDate(target: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "2-digit",
    year: "numeric",
  }).format(target);
}

/** "PREMIERA ZA 3D 4H 5M 6S" / "PREMIERES IN …", clamped at zero. */
export function formatPremiereCountdown(isPl: boolean, target: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return isPl
    ? `PREMIERA ZA ${days}D ${hours}H ${minutes}M ${seconds}S`
    : `PREMIERES IN ${days}D ${hours}H ${minutes}M ${seconds}S`;
}
