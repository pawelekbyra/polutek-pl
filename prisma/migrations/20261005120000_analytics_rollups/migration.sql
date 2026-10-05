-- Analytics rollups for the admin panel, phase A (docs/architecture/admin-phaseA.md).
--
-- Additive and idempotent: new tables in the "telemetry" schema, new functions, and one wrapper around the
-- existing telemetry.rollup_day() so that the collector's 5-minute rollup fills the new tables too, without
-- redeploying the collector. Nothing is dropped or rewritten in existing tables. Privacy is unchanged: only
-- counters and histograms, no visitor hashes (the daily distinct counts are numbers, not identifiers).
--
-- Why new tables: r_video_daily keeps exact p50/p95 per day, but percentiles of several days or videos cannot
-- be merged from percentiles. A fixed histogram can: summing buckets is exact, the percentile is read from the
-- merged histogram (error <= one bucket). Hourly rows serve "today" and the live premiere mode.
--
-- Time: days are Europe/Warsaw (like the existing rollups), hours are UTC hours (Poland's offset is always a
-- whole number of hours, so UTC hour boundaries are Warsaw hour boundaries).

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

-- Site traffic per hour. visitors = distinct daily-salted visitor hashes seen in that hour (not additive).
CREATE TABLE IF NOT EXISTS telemetry.r_traffic_hourly (
  hour      timestamptz PRIMARY KEY,
  pageviews integer NOT NULL,
  visitors  integer NOT NULL
);

-- One row per day that had any page view. single_view_visitors = visitors with exactly one page view that day
-- ("bounce" proxy: no session id exists by design).
CREATE TABLE IF NOT EXISTS telemetry.r_traffic_extra_daily (
  day                 date    PRIMARY KEY,
  visitors            integer NOT NULL,
  single_view_visitors integer NOT NULL
);

-- Playback per video and hour; an attempt belongs to the hour of its first beacon. views = started attempts
-- with at least 10 s watched (the site's own definition of a view).
CREATE TABLE IF NOT EXISTS telemetry.r_video_hourly (
  hour               timestamptz NOT NULL,
  video_id           text        NOT NULL,
  attempts           integer     NOT NULL,
  started            integer     NOT NULL,
  views              integer     NOT NULL,
  exits_before_start integer     NOT NULL,
  errors             integer     NOT NULL,
  fatal_errors       integer     NOT NULL,
  watch_ms           bigint      NOT NULL,
  rebuffer_ms        bigint      NOT NULL,
  visitors           integer     NOT NULL,
  PRIMARY KEY (hour, video_id)
);

-- QoE extras per video and day. startup_hist[k+1] = number of started attempts whose startup time fell into
-- bucket k of telemetry.startup_histogram() (edges below). The other columns complete r_video_daily.
CREATE TABLE IF NOT EXISTS telemetry.r_video_qoe_daily (
  day                 date      NOT NULL,
  video_id            text      NOT NULL,
  views               integer   NOT NULL,
  rebuffered_attempts integer   NOT NULL,
  switches            integer   NOT NULL,
  bitrate_sum         bigint    NOT NULL,
  bitrate_n           integer   NOT NULL,
  startup_n           integer   NOT NULL,
  startup_hist        integer[] NOT NULL,
  -- Per-attempt scores (Mux formulas, docs/architecture/admin-phaseA.md) summed, so any range can be averaged
  -- exactly: mean = sum / n. startup score: 100*8/(8+s) over startup_n attempts; smoothness over smoothness_n.
  startup_score_sum   double precision NOT NULL DEFAULT 0,
  smoothness_sum      double precision NOT NULL DEFAULT 0,
  smoothness_n        integer   NOT NULL DEFAULT 0,
  PRIMARY KEY (day, video_id)
);

-- Error classes per video and day (max 30 classes per video and day).
CREATE TABLE IF NOT EXISTS telemetry.r_playback_error_daily (
  day        date    NOT NULL,
  video_id   text    NOT NULL,
  error_code text    NOT NULL,
  attempts   integer NOT NULL,
  fatal      integer NOT NULL,
  PRIMARY KEY (day, video_id, error_code)
);

-- Highest rendition reached by started attempts, bucketed to ladder classes (0 = unknown).
CREATE TABLE IF NOT EXISTS telemetry.r_playback_ladder_daily (
  day      date    NOT NULL,
  video_id text    NOT NULL,
  height   integer NOT NULL,
  attempts integer NOT NULL,
  PRIMARY KEY (day, video_id, height)
);

-- Channel-wide distinct viewers and startup histogram per day (distinct counts cannot be summed per video).
CREATE TABLE IF NOT EXISTS telemetry.r_playback_total_daily (
  day          date      PRIMARY KEY,
  visitors     integer   NOT NULL,
  startup_hist integer[] NOT NULL
);

-- Snapshots of external sources (Cloudflare GraphQL: Worker HLS requests, video.pawelperfect.com cache and
-- status codes, edge traffic of www for the cross-check). Written by a future collector module; the panel only
-- reads the latest row per (source, kind) and shows its age. Payload shapes: docs/architecture/admin-phaseA.md.
CREATE TABLE IF NOT EXISTS telemetry.external_snapshot (
  source     text        NOT NULL,
  kind       text        NOT NULL,
  fetched_at timestamptz NOT NULL,
  payload    jsonb       NOT NULL,
  PRIMARY KEY (source, kind, fetched_at)
);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- Fixed bucket edges in ms: bucket 0 = below 250, bucket k = [edge k, edge k+1), last bucket (12) = 20000+.
-- Keep in sync with STARTUP_EDGES_MS in lib/modules/admin-analytics/domain/histogram.ts.
CREATE OR REPLACE FUNCTION telemetry.startup_histogram(p_values integer[]) RETURNS integer[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT array_agg(s.c ORDER BY s.b)
  FROM (
    SELECT g.b, count(v.x)::integer AS c
    FROM generate_series(0, 12) AS g(b)
    LEFT JOIN unnest(p_values) AS v(x)
      ON width_bucket(v.x::double precision, ARRAY[250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000, 20000]::double precision[]) = g.b
    GROUP BY g.b
  ) s
$$;

-- One row per play attempt in [p_lo, p_hi): the deltas of the beacons of one attempt, joined (same rules as
-- telemetry.rollup_day). Shared by all playback rollups below.
CREATE OR REPLACE FUNCTION telemetry.playback_attempts(p_lo timestamptz, p_hi timestamptz)
RETURNS TABLE (
  video_id text, attempt bigint, first_ts timestamptz, visitor bigint, started boolean, startup_ms integer,
  exited boolean, watch_ms bigint, rebuffer_ms bigint, rebuffer_count bigint, error_code text, fatal boolean,
  bitrate_kbps integer, max_height integer, switches bigint
)
LANGUAGE sql STABLE
SET search_path = telemetry, pg_temp
AS $$
  SELECT p.video_id, p.attempt, min(p.ts), min(p.visitor), bool_or(p.started), min(p.startup_ms),
         bool_or(p.exited_before_start), sum(p.watch_ms)::bigint, sum(p.rebuffer_ms)::bigint,
         sum(p.rebuffer_count)::bigint,
         coalesce(min(p.error_code) FILTER (WHERE p.fatal_error), min(p.error_code)),
         bool_or(p.fatal_error), max(p.bitrate_kbps), max(p.max_height), sum(p.switches)::bigint
  FROM telemetry.playback p
  WHERE p.ts >= p_lo AND p.ts < p_hi
  GROUP BY p.video_id, p.attempt
$$;

-- ---------------------------------------------------------------------------------------------
-- Rollup of one Europe/Warsaw day (idempotent: delete the day's rows, insert them again)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION telemetry.rollup_analytics_day(p_day date) RETURNS void
LANGUAGE plpgsql
SET search_path = telemetry, pg_temp
AS $$
DECLARE
  lo timestamptz := (p_day::timestamp AT TIME ZONE 'Europe/Warsaw');
  hi timestamptz := ((p_day + 1)::timestamp AT TIME ZONE 'Europe/Warsaw');
BEGIN
  -- Traffic
  DELETE FROM telemetry.r_traffic_hourly WHERE hour >= lo AND hour < hi;
  INSERT INTO telemetry.r_traffic_hourly (hour, pageviews, visitors)
  SELECT date_trunc('hour', pv.ts, 'UTC'), count(*)::integer, count(DISTINCT pv.visitor)::integer
  FROM telemetry.page_view pv
  WHERE pv.ts >= lo AND pv.ts < hi
  GROUP BY 1;

  DELETE FROM telemetry.r_traffic_extra_daily WHERE day = p_day;
  INSERT INTO telemetry.r_traffic_extra_daily (day, visitors, single_view_visitors)
  SELECT p_day, count(*)::integer, (count(*) FILTER (WHERE s.n = 1))::integer
  FROM (
    SELECT pv.visitor, count(*) AS n
    FROM telemetry.page_view pv
    WHERE pv.ts >= lo AND pv.ts < hi
    GROUP BY pv.visitor
  ) s
  HAVING count(*) > 0;

  -- Playback per hour
  DELETE FROM telemetry.r_video_hourly WHERE hour >= lo AND hour < hi;
  INSERT INTO telemetry.r_video_hourly (
    hour, video_id, attempts, started, views, exits_before_start, errors, fatal_errors, watch_ms, rebuffer_ms, visitors
  )
  SELECT date_trunc('hour', a.first_ts, 'UTC'), a.video_id,
         count(*)::integer,
         (count(*) FILTER (WHERE a.started))::integer,
         (count(*) FILTER (WHERE a.started AND a.watch_ms >= 10000))::integer,
         (count(*) FILTER (WHERE a.exited AND NOT a.started))::integer,
         (count(*) FILTER (WHERE a.error_code IS NOT NULL))::integer,
         (count(*) FILTER (WHERE a.fatal))::integer,
         coalesce(sum(a.watch_ms), 0)::bigint,
         coalesce(sum(a.rebuffer_ms), 0)::bigint,
         count(DISTINCT a.visitor)::integer
  FROM telemetry.playback_attempts(lo, hi) a
  GROUP BY 1, 2;

  -- QoE per video and day
  DELETE FROM telemetry.r_video_qoe_daily WHERE day = p_day;
  INSERT INTO telemetry.r_video_qoe_daily (
    day, video_id, views, rebuffered_attempts, switches, bitrate_sum, bitrate_n, startup_n, startup_hist,
    startup_score_sum, smoothness_sum, smoothness_n
  )
  SELECT p_day, a.video_id,
         (count(*) FILTER (WHERE a.started AND a.watch_ms >= 10000))::integer,
         (count(*) FILTER (WHERE a.started AND a.rebuffer_count > 0))::integer,
         coalesce(sum(a.switches), 0)::integer,
         coalesce(sum(a.bitrate_kbps) FILTER (WHERE a.started AND a.bitrate_kbps > 0), 0)::bigint,
         (count(*) FILTER (WHERE a.started AND a.bitrate_kbps > 0))::integer,
         (count(*) FILTER (WHERE a.started AND a.startup_ms IS NOT NULL))::integer,
         telemetry.startup_histogram(array_agg(a.startup_ms) FILTER (WHERE a.started AND a.startup_ms IS NOT NULL)),
         coalesce(sum(100.0::double precision * 8 / (8 + a.startup_ms / 1000.0)) FILTER (WHERE a.started AND a.startup_ms IS NOT NULL), 0),
         coalesce(sum(
           (100.0::double precision / sqrt(1 + power(a.rebuffer_count::double precision / 2, 2))
            + 100.0::double precision * exp(-10.0 * (CASE WHEN a.watch_ms + a.rebuffer_ms > 0
                                                          THEN a.rebuffer_ms::double precision / (a.watch_ms + a.rebuffer_ms)
                                                          ELSE 0 END))) / 2
         ) FILTER (WHERE a.started), 0),
         (count(*) FILTER (WHERE a.started))::integer
  FROM telemetry.playback_attempts(lo, hi) a
  GROUP BY a.video_id;

  DELETE FROM telemetry.r_playback_total_daily WHERE day = p_day;
  INSERT INTO telemetry.r_playback_total_daily (day, visitors, startup_hist)
  SELECT p_day, count(DISTINCT a.visitor)::integer,
         telemetry.startup_histogram(array_agg(a.startup_ms) FILTER (WHERE a.started AND a.startup_ms IS NOT NULL))
  FROM telemetry.playback_attempts(lo, hi) a
  HAVING count(*) > 0;

  DELETE FROM telemetry.r_playback_error_daily WHERE day = p_day;
  INSERT INTO telemetry.r_playback_error_daily (day, video_id, error_code, attempts, fatal)
  SELECT p_day, r.video_id, r.error_code, r.attempts, r.fatal
  FROM (
    SELECT a.video_id, a.error_code, count(*)::integer AS attempts, (count(*) FILTER (WHERE a.fatal))::integer AS fatal,
           row_number() OVER (PARTITION BY a.video_id ORDER BY count(*) DESC, a.error_code) AS rk
    FROM telemetry.playback_attempts(lo, hi) a
    WHERE a.error_code IS NOT NULL
    GROUP BY a.video_id, a.error_code
  ) r
  WHERE r.rk <= 30;

  DELETE FROM telemetry.r_playback_ladder_daily WHERE day = p_day;
  INSERT INTO telemetry.r_playback_ladder_daily (day, video_id, height, attempts)
  SELECT p_day, c.video_id, c.height, count(*)::integer
  FROM (
    SELECT a.video_id,
           CASE
             WHEN coalesce(a.max_height, 0) = 0 THEN 0
             WHEN a.max_height <= 240 THEN 240
             WHEN a.max_height <= 360 THEN 360
             WHEN a.max_height <= 480 THEN 480
             WHEN a.max_height <= 720 THEN 720
             WHEN a.max_height <= 1080 THEN 1080
             WHEN a.max_height <= 1440 THEN 1440
             WHEN a.max_height <= 2160 THEN 2160
             ELSE 4320
           END AS height
    FROM telemetry.playback_attempts(lo, hi) a
    WHERE a.started
  ) c
  GROUP BY c.video_id, c.height;

  -- Retention of the new tables (the collector's apply_retention knows only the older ones): hourly rows
  -- 120 days, daily rows 25 months (TELEMETRY_AGGREGATE_RETENTION_MONTHS). Whole days only, so a day that is
  -- re-rolled never loses its rows to this.
  DELETE FROM telemetry.r_traffic_hourly WHERE hour < now() - interval '120 days';
  DELETE FROM telemetry.r_video_hourly WHERE hour < now() - interval '120 days';
  DELETE FROM telemetry.r_traffic_extra_daily WHERE day < (current_date - interval '25 months')::date;
  DELETE FROM telemetry.r_video_qoe_daily WHERE day < (current_date - interval '25 months')::date;
  DELETE FROM telemetry.r_playback_total_daily WHERE day < (current_date - interval '25 months')::date;
  DELETE FROM telemetry.r_playback_error_daily WHERE day < (current_date - interval '25 months')::date;
  DELETE FROM telemetry.r_playback_ladder_daily WHERE day < (current_date - interval '25 months')::date;
  DELETE FROM telemetry.external_snapshot WHERE fetched_at < now() - interval '400 days';
END
$$;

-- Wrap the existing rollup: the collector keeps calling telemetry.rollup_day(day) every 5 minutes and now
-- fills the analytics tables as well. Guarded rename, so re-running this migration never renames the wrapper.
DO $$
BEGIN
  IF to_regprocedure('telemetry.rollup_day_core(date)') IS NULL THEN
    ALTER FUNCTION telemetry.rollup_day(date) RENAME TO rollup_day_core;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION telemetry.rollup_day(p_day date) RETURNS void
LANGUAGE plpgsql
SET search_path = telemetry, pg_temp
AS $$
BEGIN
  PERFORM telemetry.rollup_day_core(p_day);
  PERFORM telemetry.rollup_analytics_day(p_day);
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Indexes: the panel reads by video and time window (the PKs lead with day/hour; these lead with video).
-- ---------------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS r_video_hourly_video_idx ON telemetry.r_video_hourly (video_id, hour);
CREATE INDEX IF NOT EXISTS r_video_qoe_daily_video_idx ON telemetry.r_video_qoe_daily (video_id, day);
CREATE INDEX IF NOT EXISTS r_playback_error_daily_video_idx ON telemetry.r_playback_error_daily (video_id, day);
CREATE INDEX IF NOT EXISTS r_playback_ladder_daily_video_idx ON telemetry.r_playback_ladder_daily (video_id, day);
CREATE INDEX IF NOT EXISTS r_video_daily_video_idx ON telemetry.r_video_daily (video_id, day);

-- ---------------------------------------------------------------------------------------------
-- Privileges (same model as the first telemetry migration)
-- ---------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION telemetry.rollup_analytics_day(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION telemetry.rollup_day(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION telemetry.playback_attempts(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION telemetry.rollup_analytics_day(date) TO pp_collector;
GRANT EXECUTE ON FUNCTION telemetry.rollup_day(date) TO pp_collector;
GRANT EXECUTE ON FUNCTION telemetry.playback_attempts(timestamptz, timestamptz) TO pp_collector;
GRANT EXECUTE ON FUNCTION telemetry.startup_histogram(integer[]) TO pp_collector, pp_analytics_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA telemetry TO pp_collector;
GRANT SELECT ON ALL TABLES IN SCHEMA telemetry TO pp_analytics_ro;
-- With the day's salt anyone could test IP addresses against the visitor hashes: readers never see it.
REVOKE ALL ON telemetry.daily_salt FROM pp_analytics_ro;

-- ---------------------------------------------------------------------------------------------
-- One-time backfill from the raw rows that still exist (at most 100 days; raw data is kept 90 days).
-- Re-running only rebuilds the same days.
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  first_day date;
  d         date;
  today     date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
BEGIN
  SELECT least(
           coalesce((SELECT min(ts) FROM telemetry.page_view), now()),
           coalesce((SELECT min(ts) FROM telemetry.playback), now())
         ) AT TIME ZONE 'Europe/Warsaw'
    INTO first_day;
  first_day := greatest(first_day, today - 100);
  FOR d IN SELECT generate_series(first_day, today, interval '1 day')::date LOOP
    PERFORM telemetry.rollup_analytics_day(d);
  END LOOP;
END
$$;
