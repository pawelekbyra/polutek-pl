/**
 * Cloudflare edge data (C14 Worker HLS vs the daily limit, C15 cache hit and status codes on video.pawelperfect.com,
 * and the cross-check of our own page views against document requests of www). The data is NOT collected yet: the
 * collector module that queries Cloudflare GraphQL does not exist, and this panel never calls Cloudflare itself
 * (no secrets, no network at render time). Contract for that future collector: it inserts rows into
 * telemetry.external_snapshot (source 'cloudflare') with the payload shapes below; this module only reads the
 * latest row of each kind and shows its age. Until then every screen says "bez pomiaru".
 */
import { z } from "zod";
import type { EdgeSnapshot } from "../domain/types";
import type { AnalyticsDeps } from "./deps";

export const EDGE_SOURCE = "cloudflare";

/** kind 'hls_worker_hourly': requests of the HLS Worker, UTC day and hourly counts (Workers Free: 100 000 per UTC day). */
export const hlsWorkerPayload = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requests: z.number().int().nonnegative(),
  hourly: z.array(z.object({ hour: z.string(), requests: z.number().int().nonnegative() })).max(48),
});

/** kind 'edge_video_daily': video.pawelperfect.com in the last 24 h. */
export const edgeVideoPayload = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cacheHitPct: z.number().min(0).max(100),
  status403: z.number().int().nonnegative(),
  status404: z.number().int().nonnegative(),
  status5xx: z.number().int().nonnegative(),
});

/** kind 'edge_www_daily': document (HTML) requests of www per Warsaw day, bots included. */
export const edgeWwwPayload = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentRequests: z.number().int().nonnegative(),
});

const NOT_COLLECTED =
  "Ruch krawędzi Cloudflare nie jest jeszcze zbierany: potrzebny jest moduł kolektora, który co 15 minut odpytuje GraphQL Analytics i zapisuje migawkę w telemetry.external_snapshot (docs/architecture/admin-phaseA.md, „Cloudflare”).";

const STALE_MS = 2 * 15 * 60_000;

export async function edgeWwwDay(deps: AnalyticsDeps): Promise<{ available: true; day: string; documentRequests: number; fetchedAt: string } | { available: false; reason: string }> {
  if (!deps.telemetry) return { available: false, reason: "Telemetria nie jest podłączona." };
  const row = await deps.telemetry.latestSnapshot(EDGE_SOURCE, "edge_www_daily");
  if (!row) return { available: false, reason: NOT_COLLECTED };
  const parsed = edgeWwwPayload.safeParse(row.payload);
  if (!parsed.success) return { available: false, reason: "Migawka Cloudflare ma nieoczekiwany format, więc jej nie używam." };
  return { available: true, day: parsed.data.day, documentRequests: parsed.data.documentRequests, fetchedAt: row.fetchedAt.toISOString() };
}

export async function getEdgeSnapshot(deps: AnalyticsDeps): Promise<EdgeSnapshot> {
  if (!deps.telemetry) return { available: false, reason: "Telemetria nie jest podłączona." };
  const [worker, video] = await Promise.all([deps.telemetry.latestSnapshot(EDGE_SOURCE, "hls_worker_hourly"), deps.telemetry.latestSnapshot(EDGE_SOURCE, "edge_video_daily")]);
  if (!worker && !video) return { available: false, reason: NOT_COLLECTED };
  const w = worker ? hlsWorkerPayload.safeParse(worker.payload) : null;
  const v = video ? edgeVideoPayload.safeParse(video.payload) : null;
  if ((worker && !w?.success) && (video && !v?.success)) return { available: false, reason: "Migawki Cloudflare mają nieoczekiwany format, więc ich nie używam." };
  const fetchedAt = new Date(Math.max(worker?.fetchedAt.getTime() ?? 0, video?.fetchedAt.getTime() ?? 0));
  return {
    available: true,
    fetchedAt: fetchedAt.toISOString(),
    day: w?.success ? w.data.day : v?.success ? v.data.day : null,
    workerRequests: w?.success ? w.data.requests : null,
    workerLimit: deps.config.workerDailyLimit,
    workerHourly: w?.success ? w.data.hourly : [],
    cacheHitPct: v?.success ? v.data.cacheHitPct : null,
    status403: v?.success ? v.data.status403 : null,
    status404: v?.success ? v.data.status404 : null,
    status5xx: v?.success ? v.data.status5xx : null,
  };
}

/** Hours (UTC) at which the daily limit runs out at the pace of the last 3 hourly counts; null when it will not. */
export function workerLimitForecast(snapshot: Extract<EdgeSnapshot, { available: true }>, now: Date): { used: number; limit: number; exhaustAt: Date | null } | null {
  if (snapshot.workerRequests === null) return null;
  const last = snapshot.workerHourly.slice(-3);
  const perHour = last.length ? last.reduce((a, h) => a + h.requests, 0) / last.length : 0;
  const remaining = snapshot.workerLimit - snapshot.workerRequests;
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (remaining <= 0) return { used: snapshot.workerRequests, limit: snapshot.workerLimit, exhaustAt: now };
  if (perHour <= 0) return { used: snapshot.workerRequests, limit: snapshot.workerLimit, exhaustAt: null };
  const exhaustAt = new Date(now.getTime() + (remaining / perHour) * 3_600_000);
  return { used: snapshot.workerRequests, limit: snapshot.workerLimit, exhaustAt: exhaustAt < endOfDay ? exhaustAt : null };
}

export const isSnapshotStale = (fetchedAt: string, now: Date) => now.getTime() - new Date(fetchedAt).getTime() > STALE_MS;
