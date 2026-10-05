/**
 * Snapshot for the live premiere mode. Raw telemetry rows are read only here and only in windows of at most
 * 30 minutes (BRIN on ts). One snapshot is shared by all open streams (see live-hub.ts), so the database cost
 * does not grow with the number of browsers.
 */
import type { LiveSnapshot } from "../domain/types";
import type { AnalyticsDeps } from "./deps";
import { getEdgeSnapshot, isSnapshotStale, workerLimitForecast } from "./edge";
import type { LiveNow, VideoInfo } from "../infrastructure/ports";

const MINUTE = 60_000;
export const LIVE_WINDOW_MINUTES = 30;

/** 30 minute slots ending at `now`, zero-filled (inside a working live window a quiet minute is a real zero). */
export function fillMinutes(now: Date, live: LiveNow) {
  const end = Math.floor(now.getTime() / MINUTE) * MINUTE;
  const v = new Map(live.perMinute.map((r) => [r.minute.getTime(), r]));
  const p = new Map(live.pageviewsPerMinute.map((r) => [r.minute.getTime(), r.pageviews]));
  const out: LiveSnapshot["perMinute"] = [];
  for (let i = LIVE_WINDOW_MINUTES - 1; i >= 0; i--) {
    const t = end - i * MINUTE;
    const row = v.get(t);
    out.push({ minute: new Date(t).toISOString(), viewers: row?.viewers ?? 0, starts: row?.starts ?? 0, errors: row?.errors ?? 0, pageviews: p.get(t) ?? 0 });
  }
  return out;
}

export async function getLiveSnapshot(deps: AnalyticsDeps, input: { video: VideoInfo | null; since: Date | null }): Promise<LiveSnapshot> {
  const now = deps.now();
  const base: LiveSnapshot = {
    at: now.toISOString(), videoId: input.video?.id ?? null, videoTitle: input.video?.title ?? null, viewersNow: null, viewersPeak: null,
    startupP95Ms: null, startupN: 0, errorsLastMinute: null, errorShare5mPct: null, pageviewsLastMinute: null, perMinute: [], server: null, tips: null,
    comments: null, workerForecast: null, notes: [],
  };
  const [telemetry, server, tips, comments, edge] = await Promise.all([
    deps.telemetry ? deps.telemetry.live(now, input.video?.id).catch(() => null) : Promise.resolve(null),
    deps.host ? deps.host().catch(() => null) : Promise.resolve(null),
    input.since && input.since <= now ? deps.app.tipsSince(input.since).catch(() => null) : Promise.resolve(null),
    input.since && input.since <= now ? deps.app.commentsSince(input.since).catch(() => null) : Promise.resolve(null),
    getEdgeSnapshot(deps).catch(() => null),
  ]);
  const notes: string[] = [];
  if (!telemetry) notes.push("Telemetria nie odpowiada albo nie jest podłączona: widzowie i jakość są „bez pomiaru”.");
  else {
    const perMinute = fillMinutes(now, telemetry);
    const last = perMinute[perMinute.length - 1];
    const prev = perMinute[perMinute.length - 2];
    base.viewersNow = telemetry.viewers90s;
    base.viewersPeak = Math.max(telemetry.viewers90s, ...perMinute.map((m) => m.viewers));
    base.startupP95Ms = telemetry.startupP95Ms;
    base.startupN = telemetry.startupN;
    // The current minute is still filling: report the last COMPLETE minute.
    base.errorsLastMinute = prev?.errors ?? last.errors;
    base.pageviewsLastMinute = prev?.pageviews ?? last.pageviews;
    base.errorShare5mPct = telemetry.attempts5m > 0 ? (100 * telemetry.errorAttempts5m) / telemetry.attempts5m : null;
    base.perMinute = perMinute;
    if (telemetry.startupN < 20) notes.push(`Czas startu p95 z ${telemetry.startupN} startów w ostatnich 5 minutach: mała próba, orientacyjnie.`);
    notes.push("Widzowie = unikalni, którzy wysłali sygnał odtwarzania w ostatnich 90 s (odtwarzacz wysyła paczki co 30–60 s).");
  }
  base.server = server;
  base.tips = tips;
  base.comments = comments === null ? null : { count: comments };
  if (edge?.available && !isSnapshotStale(edge.fetchedAt, now)) {
    const f = workerLimitForecast(edge, now);
    if (f) {
      base.workerForecast = {
        used: f.used,
        limit: f.limit,
        reason: f.exhaustAt ? `Limit skończy się ok. ${f.exhaustAt.toISOString()} przy tempie z ostatnich 3 godzin.` : "Przy obecnym tempie limit dobowy starczy do końca doby UTC.",
      };
    }
  } else notes.push("Limit Workera HLS: bez pomiaru (ruch krawędzi Cloudflare nie jest jeszcze zbierany albo dane są nieaktualne).");
  base.notes = notes;
  return base;
}

export type LiveTarget = { video: VideoInfo | null; premiereAt: Date | null; since: Date | null; reason: string };

/** What the live mode watches: the film asked for, else the premiere closest to now (+-24 h), else the whole channel. */
export async function resolveLiveTarget(deps: AnalyticsDeps, videoKey?: string | null): Promise<LiveTarget> {
  if (videoKey) {
    const video = await deps.app.videoBySlugOrId(videoKey).catch(() => null);
    if (video) return { video, premiereAt: null, since: new Date(deps.now().getTime() - 60 * MINUTE), reason: "Wybrany film; napiwki i komentarze liczone z ostatniej godziny." };
  }
  const premiere = await deps.app.activePremiere(deps.now()).catch(() => null);
  if (premiere) {
    const video = await deps.app.videoBySlugOrId(premiere.id).catch(() => null);
    return { video, premiereAt: premiere.premiereAt, since: premiere.premiereAt, reason: "Premiera z kalendarza (w ciągu doby od teraz)." };
  }
  return { video: null, premiereAt: null, since: new Date(deps.now().getTime() - 60 * MINUTE), reason: "Brak premiery w ciągu doby: pokazuję cały kanał, napiwki i komentarze z ostatniej godziny." };
}
