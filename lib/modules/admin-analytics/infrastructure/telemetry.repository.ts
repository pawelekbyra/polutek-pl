/**
 * SQL behind the analytics screens, over the read-only role pp_analytics_ro (statement_timeout 5 s).
 * The rollups (migration 20261005120000_analytics_rollups, docs/architecture/admin-phaseA.md) make every
 * range query a scan of at most 90 daily rows per video (or 2160 hourly rows); only the live mode touches
 * raw rows, in windows of 30 minutes at most. All queries are parameterised; nothing here writes.
 */
import postgres from "postgres";
import type {
  CountryFirstSeenRow, DeployRow, DimensionRow, ErrorClassRow, LadderClassRow, LiveNow, PlaybackDayRow, PlaybackHourRow, RetentionCurveRow, RetentionDayRow,
  SnapshotRow, TelemetryRepository, TrafficDayRow, TrafficExtraRow, TrafficHourRow, VideoTotalsRow,
} from "./ports";

export type Sql = ReturnType<typeof postgres>;

const clients = new Map<string, Sql>();

/** One small pool per URL (the panel is one process, one owner): reused by every request. */
export function telemetrySql(url: string): Sql {
  let sql = clients.get(url);
  if (!sql) {
    sql = postgres(url, { max: 2, idle_timeout: 30, connect_timeout: 3, prepare: false, onnotice: () => undefined });
    clients.set(url, sql);
  }
  return sql;
}

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => Number(x) || 0) : []);
const dayStr = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export class SqlTelemetryRepository implements TelemetryRepository {
  constructor(private sql: Sql) {}

  async coverage() {
    const [row] = await this.sql`
      SELECT (SELECT min(day) FROM telemetry.r_traffic_daily)::text AS first_day,
             (SELECT max(finished_at) FROM telemetry.job_run WHERE job = 'telemetry-rollup' AND status = 'ok') AS rollup_at`;
    return { firstDay: (row?.first_day as string | null) ?? null, rollupAt: row?.rollup_at ? new Date(row.rollup_at as string) : null };
  }

  async trafficHourly(from: Date, to: Date): Promise<TrafficHourRow[]> {
    const rows = await this.sql`
      SELECT hour, pageviews, visitors FROM telemetry.r_traffic_hourly
      WHERE hour >= ${from} AND hour < ${to} ORDER BY hour LIMIT 800`;
    return rows.map((r) => ({ hour: new Date(r.hour as string), pageviews: n(r.pageviews), visitors: n(r.visitors) }));
  }

  async trafficDaily(fromDay: string, toDay: string): Promise<TrafficDayRow[]> {
    const rows = await this.sql`
      SELECT day::text AS day, pageviews, visitors FROM telemetry.r_traffic_daily
      WHERE dimension = 'total' AND value = 'all' AND day BETWEEN ${fromDay}::date AND ${toDay}::date
      ORDER BY day LIMIT 800`;
    return rows.map((r) => ({ day: dayStr(r.day), pageviews: n(r.pageviews), visitors: n(r.visitors) }));
  }

  async trafficExtra(fromDay: string, toDay: string): Promise<TrafficExtraRow[]> {
    const rows = await this.sql`
      SELECT day::text AS day, visitors, single_view_visitors FROM telemetry.r_traffic_extra_daily
      WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date ORDER BY day LIMIT 800`;
    return rows.map((r) => ({ day: dayStr(r.day), visitors: n(r.visitors), singleViewVisitors: n(r.single_view_visitors) }));
  }

  async trafficDimension(dimension: "referrer" | "country" | "utm_source", fromDay: string, toDay: string, limit: number): Promise<DimensionRow[]> {
    const rows = await this.sql`
      SELECT value, sum(pageviews)::bigint AS pageviews, sum(visitors)::bigint AS visitors
      FROM telemetry.r_traffic_daily
      WHERE dimension = ${dimension} AND day BETWEEN ${fromDay}::date AND ${toDay}::date
      GROUP BY value ORDER BY sum(visitors) DESC, value LIMIT ${Math.min(50, limit)}`;
    return rows.map((r) => ({ value: String(r.value), pageviews: n(r.pageviews), visitors: n(r.visitors) }));
  }

  async countryTotals(fromDay: string, toDay: string): Promise<DimensionRow[]> {
    const rows = await this.sql`
      SELECT value, sum(pageviews)::bigint AS pageviews, sum(visitors)::bigint AS visitors
      FROM telemetry.r_traffic_daily
      WHERE dimension = 'country' AND day BETWEEN ${fromDay}::date AND ${toDay}::date
      GROUP BY value ORDER BY sum(visitors) DESC, value LIMIT 400`;
    return rows.map((r) => ({ value: String(r.value), pageviews: n(r.pageviews), visitors: n(r.visitors) }));
  }

  async countryFirstSeen(): Promise<CountryFirstSeenRow[]> {
    const rows = await this.sql`
      SELECT value, min(day)::text AS first_day
      FROM telemetry.r_traffic_daily
      WHERE dimension = 'country' AND value <> '??' AND visitors > 0
      GROUP BY value ORDER BY min(day), value LIMIT 400`;
    return rows.map((r) => ({ code: String(r.value), firstDay: dayStr(r.first_day) }));
  }

  async playbackDaily(fromDay: string, toDay: string, videoId?: string): Promise<PlaybackDayRow[]> {
    const rows = videoId
      ? await this.sql`
          SELECT d.day::text AS day, d.attempts, d.started, d.exits_before_start, d.errors, d.fatal_errors, d.watch_ms, d.rebuffer_ms,
                 d.rebuffer_count, d.visitors, q.views, q.rebuffered_attempts, q.switches, q.bitrate_sum, q.bitrate_n, q.startup_n,
                 q.startup_score_sum, q.smoothness_sum, q.smoothness_n, q.startup_hist
          FROM telemetry.r_video_daily d
          LEFT JOIN telemetry.r_video_qoe_daily q ON q.day = d.day AND q.video_id = d.video_id
          WHERE d.video_id = ${videoId} AND d.day BETWEEN ${fromDay}::date AND ${toDay}::date
          ORDER BY d.day LIMIT 800`
      : await this.sql`
          WITH v AS (
            SELECT day, sum(attempts) AS attempts, sum(started) AS started, sum(exits_before_start) AS exits_before_start,
                   sum(errors) AS errors, sum(fatal_errors) AS fatal_errors, sum(watch_ms) AS watch_ms,
                   sum(rebuffer_ms) AS rebuffer_ms, sum(rebuffer_count) AS rebuffer_count
            FROM telemetry.r_video_daily WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY day
          ), q AS (
            SELECT day, sum(views) AS views, sum(rebuffered_attempts) AS rebuffered_attempts, sum(switches) AS switches,
                   sum(bitrate_sum) AS bitrate_sum, sum(bitrate_n) AS bitrate_n, sum(startup_n) AS startup_n,
                   sum(startup_score_sum) AS startup_score_sum, sum(smoothness_sum) AS smoothness_sum, sum(smoothness_n) AS smoothness_n
            FROM telemetry.r_video_qoe_daily WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY day
          )
          SELECT v.day::text AS day, v.attempts, v.started, v.exits_before_start, v.errors, v.fatal_errors, v.watch_ms, v.rebuffer_ms,
                 v.rebuffer_count, t.visitors, q.views, q.rebuffered_attempts, q.switches, q.bitrate_sum, q.bitrate_n, q.startup_n,
                 q.startup_score_sum, q.smoothness_sum, q.smoothness_n, t.startup_hist
          FROM v LEFT JOIN q USING (day) LEFT JOIN telemetry.r_playback_total_daily t USING (day)
          ORDER BY v.day LIMIT 800`;
    return rows.map((r) => ({
      day: dayStr(r.day), attempts: n(r.attempts), started: n(r.started), exitsBeforeStart: n(r.exits_before_start), errors: n(r.errors),
      fatalErrors: n(r.fatal_errors), watchMs: n(r.watch_ms), rebufferMs: n(r.rebuffer_ms), rebufferCount: n(r.rebuffer_count),
      visitors: n(r.visitors), views: n(r.views), rebufferedAttempts: n(r.rebuffered_attempts), switches: n(r.switches),
      bitrateSum: n(r.bitrate_sum), bitrateN: n(r.bitrate_n), startupN: n(r.startup_n), startupScoreSum: n(r.startup_score_sum),
      smoothnessSum: n(r.smoothness_sum), smoothnessN: n(r.smoothness_n), startupHist: arr(r.startup_hist),
    }));
  }

  async playbackHourly(from: Date, to: Date, videoId?: string): Promise<PlaybackHourRow[]> {
    const rows = videoId
      ? await this.sql`
          SELECT hour, attempts, started, views, exits_before_start, errors, fatal_errors, watch_ms, rebuffer_ms, visitors
          FROM telemetry.r_video_hourly WHERE video_id = ${videoId} AND hour >= ${from} AND hour < ${to} ORDER BY hour LIMIT 800`
      : await this.sql`
          SELECT hour, sum(attempts) AS attempts, sum(started) AS started, sum(views) AS views, sum(exits_before_start) AS exits_before_start,
                 sum(errors) AS errors, sum(fatal_errors) AS fatal_errors, sum(watch_ms) AS watch_ms, sum(rebuffer_ms) AS rebuffer_ms,
                 sum(visitors) AS visitors
          FROM telemetry.r_video_hourly WHERE hour >= ${from} AND hour < ${to} GROUP BY hour ORDER BY hour LIMIT 800`;
    return rows.map((r) => ({
      hour: new Date(r.hour as string), attempts: n(r.attempts), started: n(r.started), views: n(r.views), exitsBeforeStart: n(r.exits_before_start),
      errors: n(r.errors), fatalErrors: n(r.fatal_errors), watchMs: n(r.watch_ms), rebufferMs: n(r.rebuffer_ms), visitors: n(r.visitors),
    }));
  }

  async videoTotals(fromDay: string, toDay: string, limit: number): Promise<VideoTotalsRow[]> {
    const rows = await this.sql`
      WITH d AS (
        SELECT d.video_id, sum(d.attempts) AS attempts, sum(d.started) AS started, sum(d.watch_ms) AS watch_ms,
               sum((SELECT coalesce(sum(x), 0) FROM unnest(d.retention) AS x)) AS retention_sum
        FROM telemetry.r_video_daily d WHERE d.day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY d.video_id
      ), q AS (
        SELECT video_id, sum(views) AS views FROM telemetry.r_video_qoe_daily
        WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY video_id
      )
      SELECT d.video_id, d.attempts, d.started, coalesce(q.views, 0) AS views, d.watch_ms, d.retention_sum
      FROM d LEFT JOIN q USING (video_id) ORDER BY d.started DESC, d.video_id LIMIT ${Math.min(100, limit)}`;
    return rows.map((r) => ({ videoId: String(r.video_id), attempts: n(r.attempts), started: n(r.started), views: n(r.views), watchMs: n(r.watch_ms), retentionSum: n(r.retention_sum) }));
  }

  async retentionDays(videoId: string, fromDay: string, toDay: string): Promise<RetentionDayRow[]> {
    const rows = await this.sql`
      SELECT day::text AS day, started, retention FROM telemetry.r_video_daily
      WHERE video_id = ${videoId} AND day BETWEEN ${fromDay}::date AND ${toDay}::date ORDER BY day LIMIT 800`;
    return rows.map((r) => ({ day: dayStr(r.day), started: n(r.started), retention: arr(r.retention) }));
  }

  async retentionByVideo(fromDay: string, toDay: string, limit: number): Promise<RetentionCurveRow[]> {
    const rows = await this.sql`
      WITH picked AS (
        SELECT video_id, sum(started) AS started FROM telemetry.r_video_daily
        WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY video_id ORDER BY sum(started) DESC LIMIT ${Math.min(50, limit)}
      ), curve AS (
        SELECT d.video_id, u.i, sum(u.v) AS s
        FROM telemetry.r_video_daily d
        JOIN picked p USING (video_id)
        CROSS JOIN LATERAL unnest(d.retention) WITH ORDINALITY AS u(v, i)
        WHERE d.day BETWEEN ${fromDay}::date AND ${toDay}::date
        GROUP BY d.video_id, u.i
      )
      SELECT p.video_id, p.started, array_agg(c.s ORDER BY c.i) AS retention
      FROM picked p JOIN curve c USING (video_id) GROUP BY p.video_id, p.started`;
    return rows.map((r) => ({ videoId: String(r.video_id), started: n(r.started), retention: arr(r.retention) }));
  }

  async errorClasses(fromDay: string, toDay: string, videoId: string | undefined, limit: number): Promise<ErrorClassRow[]> {
    const rows = videoId
      ? await this.sql`
          SELECT error_code, sum(attempts) AS attempts, sum(fatal) AS fatal FROM telemetry.r_playback_error_daily
          WHERE video_id = ${videoId} AND day BETWEEN ${fromDay}::date AND ${toDay}::date
          GROUP BY error_code ORDER BY sum(attempts) DESC, error_code LIMIT ${Math.min(30, limit)}`
      : await this.sql`
          SELECT error_code, sum(attempts) AS attempts, sum(fatal) AS fatal FROM telemetry.r_playback_error_daily
          WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date
          GROUP BY error_code ORDER BY sum(attempts) DESC, error_code LIMIT ${Math.min(30, limit)}`;
    return rows.map((r) => ({ code: String(r.error_code), attempts: n(r.attempts), fatal: n(r.fatal) }));
  }

  async ladder(fromDay: string, toDay: string, videoId?: string): Promise<LadderClassRow[]> {
    const rows = videoId
      ? await this.sql`
          SELECT height, sum(attempts) AS attempts FROM telemetry.r_playback_ladder_daily
          WHERE video_id = ${videoId} AND day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY height ORDER BY height`
      : await this.sql`
          SELECT height, sum(attempts) AS attempts FROM telemetry.r_playback_ladder_daily
          WHERE day BETWEEN ${fromDay}::date AND ${toDay}::date GROUP BY height ORDER BY height`;
    return rows.map((r) => ({ height: n(r.height), attempts: n(r.attempts) }));
  }

  async deploys(from: Date, to: Date, limit: number): Promise<DeployRow[]> {
    const rows = await this.sql`
      SELECT coalesce(finished_at, started_at) AS at, job, detail FROM telemetry.job_run
      WHERE job IN ('deploy', 'deploy-admin') AND status = 'ok' AND started_at >= ${from} AND started_at <= ${to}
      ORDER BY started_at LIMIT ${Math.min(100, limit)}`;
    return rows.map((r) => ({ at: new Date(r.at as string), job: String(r.job), detail: (r.detail as string | null) ?? null }));
  }

  async latestSnapshot(source: string, kind: string): Promise<SnapshotRow | null> {
    const [row] = await this.sql`
      SELECT fetched_at, payload FROM telemetry.external_snapshot WHERE source = ${source} AND kind = ${kind}
      ORDER BY fetched_at DESC LIMIT 1`;
    return row ? { fetchedAt: new Date(row.fetched_at as string), payload: row.payload } : null;
  }

  async live(now: Date, videoId?: string): Promise<LiveNow> {
    const since30 = new Date(now.getTime() - 30 * 60_000);
    const since5 = new Date(now.getTime() - 5 * 60_000);
    const since90s = new Date(now.getTime() - 90_000);
    const [now90, agg5, perMinute, views] = await Promise.all([
      videoId
        ? this.sql`SELECT count(DISTINCT visitor) AS c FROM telemetry.playback WHERE ts > ${since90s} AND ts <= ${now} AND video_id = ${videoId}`
        : this.sql`SELECT count(DISTINCT visitor) AS c FROM telemetry.playback WHERE ts > ${since90s} AND ts <= ${now}`,
      videoId
        ? this.sql`
            SELECT count(DISTINCT attempt) AS attempts, count(DISTINCT attempt) FILTER (WHERE error_code IS NOT NULL) AS errored,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY startup_ms) FILTER (WHERE started AND startup_ms IS NOT NULL) AS p95,
                   count(*) FILTER (WHERE started AND startup_ms IS NOT NULL) AS startup_n
            FROM telemetry.playback WHERE ts > ${since5} AND ts <= ${now} AND video_id = ${videoId}`
        : this.sql`
            SELECT count(DISTINCT attempt) AS attempts, count(DISTINCT attempt) FILTER (WHERE error_code IS NOT NULL) AS errored,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY startup_ms) FILTER (WHERE started AND startup_ms IS NOT NULL) AS p95,
                   count(*) FILTER (WHERE started AND startup_ms IS NOT NULL) AS startup_n
            FROM telemetry.playback WHERE ts > ${since5} AND ts <= ${now}`,
      videoId
        ? this.sql`
            SELECT date_trunc('minute', ts, 'UTC') AS minute, count(DISTINCT visitor) AS viewers,
                   count(DISTINCT attempt) FILTER (WHERE started) AS starts, count(DISTINCT attempt) FILTER (WHERE error_code IS NOT NULL) AS errors
            FROM telemetry.playback WHERE ts > ${since30} AND ts <= ${now} AND video_id = ${videoId} GROUP BY 1 ORDER BY 1`
        : this.sql`
            SELECT date_trunc('minute', ts, 'UTC') AS minute, count(DISTINCT visitor) AS viewers,
                   count(DISTINCT attempt) FILTER (WHERE started) AS starts, count(DISTINCT attempt) FILTER (WHERE error_code IS NOT NULL) AS errors
            FROM telemetry.playback WHERE ts > ${since30} AND ts <= ${now} GROUP BY 1 ORDER BY 1`,
      this.sql`
        SELECT date_trunc('minute', ts, 'UTC') AS minute, count(*) AS pageviews
        FROM telemetry.page_view WHERE ts > ${since30} AND ts <= ${now} GROUP BY 1 ORDER BY 1`,
    ]);
    const a = agg5[0];
    return {
      viewers90s: n(now90[0]?.c),
      startupP95Ms: nn(a?.p95),
      startupN: n(a?.startup_n),
      attempts5m: n(a?.attempts),
      errorAttempts5m: n(a?.errored),
      perMinute: perMinute.map((r) => ({ minute: new Date(r.minute as string), viewers: n(r.viewers), starts: n(r.starts), errors: n(r.errors) })),
      pageviewsPerMinute: views.map((r) => ({ minute: new Date(r.minute as string), pageviews: n(r.pageviews) })),
    };
  }
}
