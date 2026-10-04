/**
 * Traffic peaks from our own telemetry (schema `telemetry`, docs/architecture/admin-telemetry.md), read with
 * the read-only role pp_analytics_ro over its own connection (ADMIN_TELEMETRY_DATABASE_URL): the site's
 * database role has no access to `telemetry`, and this role cannot see `public`. One query, cached 60 s in
 * the process; any failure is an explicit "no data" for the meter, never zeros.
 */
import postgres from "postgres";
import type { TelemetryPeaks } from "../domain/server-headroom";

export type TelemetryPeaksRead = { ok: true; peaks: TelemetryPeaks } | { ok: false; reason: string };

type Sql = ReturnType<typeof postgres>;
let client: { url: string; sql: Sql } | null = null;
let cache: { at: number; value: TelemetryPeaksRead } | null = null;
const FRESH_MS = 60_000;

function sqlFor(url: string): Sql {
  if (client?.url !== url) client = { url, sql: postgres(url, { max: 1, idle_timeout: 30, connect_timeout: 3, prepare: false, onnotice: () => undefined }) };
  return client.sql;
}

const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function readTelemetryPeaks(url: string, now: Date): Promise<TelemetryPeaksRead> {
  if (cache && now.getTime() - cache.at < FRESH_MS) return cache.value;
  let value: TelemetryPeaksRead;
  try {
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const h24 = new Date(now.getTime() - 86_400_000);
    const h1 = new Date(now.getTime() - 3_600_000);
    const [row] = await sqlFor(url)`
      WITH v AS (SELECT ts FROM telemetry.page_view WHERE ts > ${since} AND ts <= ${now}),
           m AS (SELECT date_trunc('minute', ts) AS b, count(*) AS c FROM v GROUP BY 1),
           s AS (SELECT date_trunc('second', ts) AS b, count(*) AS c FROM v GROUP BY 1)
      SELECT
        (SELECT min(ts) FROM v) AS first_at,
        (SELECT count(*) FROM v WHERE ts > ${h24}) AS views24h,
        (SELECT max(c) FROM m WHERE b > ${h1}) AS m1h,
        (SELECT max(c) FROM m WHERE b > ${h24}) AS m24h,
        (SELECT max(c) FROM m) AS m7d,
        (SELECT max(c) FROM s WHERE b > ${h1}) AS s1h,
        (SELECT max(c) FROM s WHERE b > ${h24}) AS s24h,
        (SELECT max(c) FROM s) AS s7d`;
    value = {
      ok: true,
      peaks: {
        firstAt: row?.first_at ? new Date(row.first_at as string).toISOString() : null,
        views24h: n(row?.views24h) ?? 0,
        peakMinute: { h1: n(row?.m1h), h24: n(row?.m24h), d7: n(row?.m7d) },
        peakSecond: { h1: n(row?.s1h), h24: n(row?.s24h), d7: n(row?.s7d) },
      },
    };
  } catch (error) {
    value = { ok: false, reason: `Odczyt telemetrii nie powiódł się (${error instanceof Error ? error.name : "błąd"}).` };
  }
  cache = { at: now.getTime(), value };
  return value;
}

export function clearTelemetryPeaksCache() {
  cache = null;
}
