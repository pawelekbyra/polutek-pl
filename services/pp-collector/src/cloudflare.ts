import type { Sql } from "./db";
import { recordJobRun } from "./db";

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const POLL_INTERVAL_MS = 15 * 60_000;
const VIDEO_HOST = "video.pawelperfect.com";

type WorkerRow = { dimensions?: { datetime?: string }; sum?: { requests?: number } };
type HttpRow = { count?: number; dimensions?: { datetimeHour?: string; cacheStatus?: string; edgeResponseStatus?: number | string } };
type GraphqlResult = {
  data?: {
    viewer?: {
      accounts?: Array<{ workersInvocationsAdaptive?: WorkerRow[] }>;
      zones?: Array<{ httpRequestsAdaptiveGroups?: HttpRow[] }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

export type CloudflareConfig = {
  token: string;
  accountTag: string;
  zoneTag: string;
  workerName: string;
};

export function cloudflareConfig(env: NodeJS.ProcessEnv = process.env): CloudflareConfig | null {
  const token = env.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim();
  const accountTag = env.CLOUDFLARE_ACCOUNT_TAG?.trim();
  const zoneTag = env.CLOUDFLARE_ZONE_TAG?.trim();
  const workerName = env.CLOUDFLARE_HLS_WORKER_NAME?.trim();
  if (!token && !accountTag && !zoneTag && !workerName) return null;
  if (!token || !/^[a-f0-9]{32}$/i.test(accountTag ?? "") || !/^[a-f0-9]{32}$/i.test(zoneTag ?? "") || !workerName || workerName.length > 128) {
    throw new Error("Cloudflare Analytics configuration is incomplete or malformed");
  }
  return { token, accountTag: accountTag!, zoneTag: zoneTag!, workerName };
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hourKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Cloudflare returned an invalid timestamp");
  return date.toISOString().slice(0, 13) + ":00:00Z";
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

export async function queryCloudflare(config: CloudflareConfig, now = new Date(), fetcher: typeof fetch = fetch): Promise<{
  worker: { day: string; requests: number; hourly: Array<{ hour: string; requests: number }> };
  video: { day: string; cacheHitPct: number; status403: number; status404: number; status5xx: number };
}> {
  const currentHour = new Date(now);
  currentHour.setUTCMinutes(0, 0, 0);
  const workerStart = new Date(currentHour.getTime() - 47 * 60 * 60_000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const end = now.toISOString();
  const query = `query {
    viewer {
      accounts(filter: { accountTag: ${quoted(config.accountTag)} }) {
        workersInvocationsAdaptive(limit: 10000, filter: { scriptName: ${quoted(config.workerName)}, datetime_geq: ${quoted(workerStart)}, datetime_leq: ${quoted(end)} }) {
          dimensions { datetime }
          sum { requests }
        }
      }
      zones(filter: { zoneTag: ${quoted(config.zoneTag)} }) {
        httpRequestsAdaptiveGroups(limit: 5000, filter: { clientRequestHTTPHost: ${quoted(VIDEO_HOST)}, datetime_geq: ${quoted(yesterday)}, datetime_leq: ${quoted(end)} }) {
          count
          dimensions { datetimeHour cacheStatus edgeResponseStatus }
        }
      }
    }
  }`;

  const response = await fetcher(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Cloudflare Analytics returned HTTP ${response.status}`);
  const result = (await response.json()) as GraphqlResult;
  if (result.errors?.length) throw new Error(`Cloudflare Analytics query failed: ${result.errors[0]?.message?.slice(0, 300) ?? "unknown error"}`);
  const account = result.data?.viewer?.accounts?.[0];
  const zone = result.data?.viewer?.zones?.[0];
  if (!account || !zone) throw new Error("Cloudflare Analytics returned no account or zone data");

  const hourlyCounts = new Map<string, number>();
  for (const row of account.workersInvocationsAdaptive ?? []) {
    const time = row.dimensions?.datetime;
    const requests = row.sum?.requests;
    if (!time || typeof requests !== "number" || !Number.isFinite(requests) || requests < 0) continue;
    const hour = hourKey(time);
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + requests);
  }
  const today = utcDay(now);
  // Cloudflare omits empty intervals; write explicit zeroes so the three-hour rate estimate does
  // not mistake a quiet hour for a missing observation and overstate the remaining pace.
  const hourly = Array.from({ length: 48 }, (_, index) => {
    const date = new Date(currentHour.getTime() - (47 - index) * 60 * 60_000);
    const hour = date.toISOString().slice(0, 13) + ":00:00Z";
    return { hour, requests: Math.round(hourlyCounts.get(hour) ?? 0) };
  });
  const workerRequests = hourly.reduce((total, row) => row.hour.slice(0, 10) === today ? total + row.requests : total, 0);

  let totalRequests = 0;
  let cachedRequests = 0;
  let status403 = 0;
  let status404 = 0;
  let status5xx = 0;
  for (const row of zone.httpRequestsAdaptiveGroups ?? []) {
    const count = row.count;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) continue;
    totalRequests += count;
    if (row.dimensions?.cacheStatus?.toLowerCase() === "hit") cachedRequests += count;
    const status = Number(row.dimensions?.edgeResponseStatus);
    if (status === 403) status403 += count;
    if (status === 404) status404 += count;
    if (status >= 500 && status < 600) status5xx += count;
  }

  return {
    worker: { day: today, requests: Math.round(workerRequests), hourly },
    video: {
      day: today,
      cacheHitPct: totalRequests ? Math.round((cachedRequests / totalRequests) * 10_000) / 100 : 0,
      status403: Math.round(status403),
      status404: Math.round(status404),
      status5xx: Math.round(status5xx),
    },
  };
}

export async function collectCloudflareSnapshots(sql: Sql, host: string, now = new Date(), env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const startedAt = new Date();
  const config = cloudflareConfig(env);
  if (!config) return false;
  try {
    const snapshot = await queryCloudflare(config, now);
    await sql.begin(async (tx) => {
      await tx`insert into telemetry.external_snapshot (source, kind, fetched_at, payload)
        values ('cloudflare', 'hls_worker_hourly', ${now}, ${tx.json(snapshot.worker)})`;
      await tx`insert into telemetry.external_snapshot (source, kind, fetched_at, payload)
        values ('cloudflare', 'edge_video_daily', ${now}, ${tx.json(snapshot.video)})`;
    });
    await recordJobRun(sql, "cloudflare-analytics", startedAt, "ok", "HLS Worker and video edge snapshots collected", host);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await recordJobRun(sql, "cloudflare-analytics", startedAt, "fail", message, host).catch(() => {});
    throw error;
  }
}

export { POLL_INTERVAL_MS as CLOUDFLARE_POLL_INTERVAL_MS };
