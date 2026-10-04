/**
 * "Zapas serwera": how far the real traffic peak is from the measured limit of the server. Pure.
 * Peak = the busiest minute of page views (telemetry.page_view) turned into views per second; the load
 * test limits are minute-scale too. Headroom = 1 - peak/limit. Colours: up to 50% of the limit ok,
 * 50-80% warn, above 80% crit. One page view is counted as one visit (a new entry renders the same pages).
 */
import type { StateKind } from "./types";
import type { ServerCapacity } from "./server-capacity.config";

export type TelemetryPeaks = {
  /** Oldest page view in the last 7 days (null = no data at all). */
  firstAt: string | null;
  views24h: number;
  /** Busiest minute (views in that minute) and busiest second, per window. null = no views in the window. */
  peakMinute: { h1: number | null; h24: number | null; d7: number | null };
  peakSecond: { h1: number | null; h24: number | null; d7: number | null };
};

export type PeakWindow = "h1" | "h24" | "d7";

export type ServerHeadroom =
  | { state: "unconfigured"; reason: string; capacity: ServerCapacity }
  | { state: "error"; reason: string; capacity: ServerCapacity }
  | {
      state: "ok";
      capacity: ServerCapacity;
      /** Hours of telemetry behind the numbers (capped at 7 days). */
      coverageHours: number;
      /** false = less than 24 h of data: show the numbers, but say it honestly. */
      enoughData: boolean;
      windows: Record<PeakWindow, { perSec: number | null; peakSecond: number | null }>;
      /** The window the meter uses: 24 h (7 days when there is no 24 h peak yet... never longer than the data). */
      basis: PeakWindow;
      peakPerSec: number;
      usage: number;
      headroom: number;
      kind: StateKind;
      recommendation: string;
      views24h: number;
      dailyAtLimit: number;
      dailyComfortable: number;
    };

export const HEADROOM_WARN_AT = 0.5;
export const HEADROOM_CRIT_AT = 0.8;

export function usageKind(usage: number): StateKind {
  if (usage > HEADROOM_CRIT_AT) return "crit";
  if (usage >= HEADROOM_WARN_AT) return "warn";
  return "ok";
}

/** Page views per day whose busiest hour runs at `perSec` (busiest hour = peakHourShare of the day). */
export function dailyViewsAt(perSec: number, peakHourShare: number): number {
  if (!(peakHourShare > 0)) return 0;
  return Math.round((perSec * 3600) / peakHourShare);
}

export function recommendationFor(kind: StateKind, enoughData: boolean): string {
  if (kind === "crit") return "Szczyt jest blisko granicy: powiększ serwer albo włącz cache strony dla gości teraz, nie dopiero przed premierą.";
  if (kind === "warn") return "Powiększ serwer przed premierą: szczyt przekroczył połowę granicy.";
  return enoughData ? "Zapas wystarczy na obecny ruch. Przy zapowiedzi dużej premiery sprawdź ponownie." : "Na razie zapas jest duży, ale danych jest mniej niż z 24 godzin.";
}

export function computeServerHeadroom(peaks: TelemetryPeaks, capacity: ServerCapacity, now: Date): ServerHeadroom {
  if (!peaks.firstAt) return { state: "error", reason: "Brak odsłon w telemetrii z ostatnich 7 dni (beacon wyłączony albo kolektor nie zapisuje).", capacity };
  const coverageHours = Math.max(0, Math.min(7 * 24, (now.getTime() - new Date(peaks.firstAt).getTime()) / 3_600_000));
  const perSec = (m: number | null) => (m === null ? null : m / 60);
  const windows = {
    h1: { perSec: perSec(peaks.peakMinute.h1), peakSecond: peaks.peakSecond.h1 },
    h24: { perSec: perSec(peaks.peakMinute.h24), peakSecond: peaks.peakSecond.h24 },
    d7: { perSec: perSec(peaks.peakMinute.d7), peakSecond: peaks.peakSecond.d7 },
  };
  const basis: PeakWindow = windows.h24.perSec !== null ? "h24" : windows.d7.perSec !== null ? "d7" : "h1";
  const peakPerSec = windows[basis].perSec ?? 0;
  const usage = capacity.limitPerSec > 0 ? peakPerSec / capacity.limitPerSec : 0;
  const kind = usageKind(usage);
  const enoughData = coverageHours >= 24;
  return {
    state: "ok",
    capacity,
    coverageHours,
    enoughData,
    windows,
    basis,
    peakPerSec,
    usage,
    headroom: Math.max(0, 1 - usage),
    kind,
    recommendation: recommendationFor(kind, enoughData),
    views24h: peaks.views24h,
    dailyAtLimit: dailyViewsAt(capacity.limitPerSec, capacity.peakHourShare),
    dailyComfortable: dailyViewsAt(capacity.comfortablePerSec, capacity.peakHourShare),
  };
}
