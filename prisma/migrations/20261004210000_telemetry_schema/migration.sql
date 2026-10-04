-- Own analytics and operations telemetry (docs/architecture/admin-telemetry.md).
--
-- Everything lives in the separate schema "telemetry", written by the pp-collector service (role
-- pp_collector) and read by the admin panel (role pp_analytics_ro). Prisma manages only the "public"
-- schema, so nothing here is modelled in schema.prisma: partitioned tables, roles and functions cannot
-- be expressed there. Additive and idempotent: safe to run again.
--
-- Privacy: no raw IP addresses, user agents, cookies, user ids or full URLs are stored. A visitor is a
-- 64-bit hash of (daily salt, IP, user agent, host); the salt is deleted after its day, so hashes from
-- different days cannot be linked. Raw rows are kept 90 days, daily aggregates 25 months.

CREATE SCHEMA IF NOT EXISTS telemetry;

-- Roles are cluster-wide. NOLOGIN here; on the server the operator enables login with a password
-- (docs/operations/SERWEREK.md, "Telemetria"). Never superusers.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pp_collector') THEN
    CREATE ROLE pp_collector NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pp_analytics_ro') THEN
    CREATE ROLE pp_analytics_ro NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Raw events (monthly range partitions on ts, UTC month boundaries, kept 90 days)
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS telemetry.page_view (
  ts            timestamptz NOT NULL,
  visitor       bigint      NOT NULL,
  path          text        NOT NULL,
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  country       text,
  device        text        NOT NULL,
  browser       text        NOT NULL,
  os            text        NOT NULL,
  lang          text,
  signed_in     boolean     NOT NULL DEFAULT false
) PARTITION BY RANGE (ts);

CREATE TABLE IF NOT EXISTS telemetry.web_vital (
  ts       timestamptz      NOT NULL,
  path     text             NOT NULL,
  metric   text             NOT NULL,
  value    double precision NOT NULL,
  rating   text,
  nav_type text,
  device   text             NOT NULL
) PARTITION BY RANGE (ts);

-- One row per beacon per play attempt. Counters are deltas since the previous beacon of the same
-- attempt; `watched` is the cumulative 1%-bucket bitmap (bit_or makes repeats harmless).
CREATE TABLE IF NOT EXISTS telemetry.playback (
  ts                  timestamptz NOT NULL,
  attempt             bigint      NOT NULL,
  visitor             bigint      NOT NULL,
  video_id            text        NOT NULL,
  started             boolean     NOT NULL DEFAULT false,
  startup_ms          integer,
  exited_before_start boolean     NOT NULL DEFAULT false,
  watch_ms            integer     NOT NULL DEFAULT 0,
  rebuffer_count      integer     NOT NULL DEFAULT 0,
  rebuffer_ms         integer     NOT NULL DEFAULT 0,
  error_code          text,
  fatal_error         boolean     NOT NULL DEFAULT false,
  bitrate_kbps        integer,
  max_height          integer,
  switches            integer     NOT NULL DEFAULT 0,
  watched             bit(100),
  device              text        NOT NULL,
  country             text
) PARTITION BY RANGE (ts);

-- Catch-all partitions: an insert never fails because a monthly partition is missing.
CREATE TABLE IF NOT EXISTS telemetry.page_view_default PARTITION OF telemetry.page_view DEFAULT;
CREATE TABLE IF NOT EXISTS telemetry.web_vital_default PARTITION OF telemetry.web_vital DEFAULT;
CREATE TABLE IF NOT EXISTS telemetry.playback_default  PARTITION OF telemetry.playback DEFAULT;

-- BRIN on the append-only time column: tiny, and every query is a time range.
CREATE INDEX IF NOT EXISTS page_view_ts_brin ON telemetry.page_view USING brin (ts);
CREATE INDEX IF NOT EXISTS web_vital_ts_brin ON telemetry.web_vital USING brin (ts);
CREATE INDEX IF NOT EXISTS playback_ts_brin  ON telemetry.playback  USING brin (ts);

-- ---------------------------------------------------------------------------------------------
-- Daily aggregates (Europe/Warsaw days, kept 25 months)
-- ---------------------------------------------------------------------------------------------

-- dimension: total | path | referrer | country | device | browser | os | utm_source | utm_medium |
-- utm_campaign | signed_in. Up to 1000 values per dimension and day (spam cannot blow it up).
CREATE TABLE IF NOT EXISTS telemetry.r_traffic_daily (
  day       date    NOT NULL,
  dimension text    NOT NULL,
  value     text    NOT NULL,
  pageviews integer NOT NULL,
  visitors  integer NOT NULL,
  PRIMARY KEY (day, dimension, value)
);

-- device = 'all' plus one row per device class.
CREATE TABLE IF NOT EXISTS telemetry.r_vitals_daily (
  day               date             NOT NULL,
  metric            text             NOT NULL,
  device            text             NOT NULL,
  n                 integer          NOT NULL,
  p50               double precision NOT NULL,
  p75               double precision NOT NULL,
  p95               double precision NOT NULL,
  good              integer          NOT NULL,
  needs_improvement integer          NOT NULL,
  poor              integer          NOT NULL,
  PRIMARY KEY (day, metric, device)
);

-- QoE per video and day (definitions: docs/architecture/admin-telemetry.md). retention[k] = number of
-- play attempts that watched the k-th 1% of the video.
CREATE TABLE IF NOT EXISTS telemetry.r_video_daily (
  day                date      NOT NULL,
  video_id           text      NOT NULL,
  attempts           integer   NOT NULL,
  started            integer   NOT NULL,
  exits_before_start integer   NOT NULL,
  errors             integer   NOT NULL,
  fatal_errors       integer   NOT NULL,
  visitors           integer   NOT NULL,
  watch_ms           bigint    NOT NULL,
  rebuffer_ms        bigint    NOT NULL,
  rebuffer_count     integer   NOT NULL,
  startup_p50_ms     integer,
  startup_p95_ms     integer,
  retention          integer[] NOT NULL,
  PRIMARY KEY (day, video_id)
);

-- ---------------------------------------------------------------------------------------------
-- Salt and job log
-- ---------------------------------------------------------------------------------------------

-- One random salt per Europe/Warsaw day. Deleted as soon as the day is over.
CREATE TABLE IF NOT EXISTS telemetry.daily_salt (
  day        date        PRIMARY KEY,
  salt       bytea       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every periodic job (systemd crons, backup, health, restore test, deploys, telemetry jobs) writes one
-- row per run. Kept 400 days. The admin panel and the watchdog read the latest row per job.
CREATE TABLE IF NOT EXISTS telemetry.job_run (
  id          bigserial   PRIMARY KEY,
  job         text        NOT NULL,
  status      text        NOT NULL CHECK (status IN ('running', 'ok', 'fail')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  detail      text,
  host        text
);
CREATE INDEX IF NOT EXISTS job_run_job_started_idx ON telemetry.job_run (job, started_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------

-- Creates monthly partitions for `p_months` months starting at the month of `p_from` (UTC). Creating
-- or dropping a partition needs the parent's owner, hence SECURITY DEFINER (owner = the migration role)
-- with a fixed search_path; only pp_collector may execute it.
CREATE OR REPLACE FUNCTION telemetry.ensure_partitions(
  p_from   date    DEFAULT (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month')::date,
  p_months integer DEFAULT 4
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = telemetry, pg_temp
AS $$
DECLARE
  parent  text;
  month   date;
  part    text;
  created integer := 0;
BEGIN
  FOREACH parent IN ARRAY ARRAY['page_view', 'web_vital', 'playback'] LOOP
    FOR i IN 0 .. p_months - 1 LOOP
      month := (date_trunc('month', p_from) + make_interval(months => i))::date;
      part := format('%s_%s', parent, to_char(month, 'YYYYMM'));
      IF to_regclass(format('telemetry.%I', part)) IS NULL THEN
        EXECUTE format(
          'CREATE TABLE telemetry.%I PARTITION OF telemetry.%I FOR VALUES FROM (%L) TO (%L)',
          part, parent,
          (month::timestamp AT TIME ZONE 'UTC'),
          ((month + interval '1 month')::timestamp AT TIME ZONE 'UTC')
        );
        created := created + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN created;
END
$$;

-- Rebuilds the three daily aggregates of one Europe/Warsaw day from the raw rows. Idempotent: run it
-- for today and yesterday every few minutes.
CREATE OR REPLACE FUNCTION telemetry.rollup_day(p_day date) RETURNS void
LANGUAGE plpgsql
SET search_path = telemetry, pg_temp
AS $$
DECLARE
  lo timestamptz := (p_day::timestamp AT TIME ZONE 'Europe/Warsaw');
  hi timestamptz := ((p_day + 1)::timestamp AT TIME ZONE 'Europe/Warsaw');
BEGIN
  DELETE FROM telemetry.r_traffic_daily WHERE day = p_day;
  INSERT INTO telemetry.r_traffic_daily (day, dimension, value, pageviews, visitors)
  SELECT p_day, dimension, value, pageviews, visitors
  FROM (
    SELECT d.dimension, d.value, count(*)::integer AS pageviews, count(DISTINCT pv.visitor)::integer AS visitors,
           row_number() OVER (PARTITION BY d.dimension ORDER BY count(*) DESC, d.value) AS rank
    FROM telemetry.page_view pv
    CROSS JOIN LATERAL (VALUES
      ('total', 'all'),
      ('path', pv.path),
      ('referrer', coalesce(pv.referrer_host, '(direct)')),
      ('country', coalesce(pv.country, '??')),
      ('device', pv.device),
      ('browser', pv.browser),
      ('os', pv.os),
      ('utm_source', pv.utm_source),
      ('utm_medium', pv.utm_medium),
      ('utm_campaign', pv.utm_campaign),
      ('signed_in', pv.signed_in::text)
    ) AS d(dimension, value)
    WHERE pv.ts >= lo AND pv.ts < hi AND d.value IS NOT NULL
    GROUP BY d.dimension, d.value
  ) ranked
  WHERE rank <= 1000;

  DELETE FROM telemetry.r_vitals_daily WHERE day = p_day;
  INSERT INTO telemetry.r_vitals_daily (day, metric, device, n, p50, p75, p95, good, needs_improvement, poor)
  SELECT p_day, wv.metric, d.device, count(*)::integer,
         percentile_cont(0.50) WITHIN GROUP (ORDER BY wv.value),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY wv.value),
         percentile_cont(0.95) WITHIN GROUP (ORDER BY wv.value),
         count(*) FILTER (WHERE wv.rating = 'good')::integer,
         count(*) FILTER (WHERE wv.rating = 'needs-improvement')::integer,
         count(*) FILTER (WHERE wv.rating = 'poor')::integer
  FROM telemetry.web_vital wv
  CROSS JOIN LATERAL (VALUES (wv.device), ('all')) AS d(device)
  WHERE wv.ts >= lo AND wv.ts < hi
  GROUP BY wv.metric, d.device;

  DELETE FROM telemetry.r_video_daily WHERE day = p_day;
  WITH attempts AS (
    SELECT video_id, attempt,
           min(visitor)                       AS visitor,
           bool_or(started)                   AS started,
           min(startup_ms)                    AS startup_ms,
           bool_or(exited_before_start)       AS exited,
           sum(watch_ms)                      AS watch_ms,
           sum(rebuffer_ms)                   AS rebuffer_ms,
           sum(rebuffer_count)                AS rebuffer_count,
           bool_or(error_code IS NOT NULL)    AS had_error,
           bool_or(fatal_error)               AS fatal,
           bit_or(watched)                    AS watched
    FROM telemetry.playback
    WHERE ts >= lo AND ts < hi
    GROUP BY video_id, attempt
  ), retention AS (
    SELECT per_bucket.video_id, array_agg(per_bucket.c ORDER BY per_bucket.k) AS curve
    FROM (
      SELECT x.video_id, k, count(*) FILTER (WHERE x.watched IS NOT NULL AND get_bit(x.watched, k) = 1)::integer AS c
      FROM attempts x CROSS JOIN generate_series(0, 99) AS k
      GROUP BY x.video_id, k
    ) per_bucket
    GROUP BY per_bucket.video_id
  )
  INSERT INTO telemetry.r_video_daily (
    day, video_id, attempts, started, exits_before_start, errors, fatal_errors, visitors,
    watch_ms, rebuffer_ms, rebuffer_count, startup_p50_ms, startup_p95_ms, retention
  )
  SELECT p_day, a.video_id,
         count(*)::integer,
         count(*) FILTER (WHERE a.started)::integer,
         count(*) FILTER (WHERE a.exited AND NOT a.started)::integer,
         count(*) FILTER (WHERE a.had_error)::integer,
         count(*) FILTER (WHERE a.fatal)::integer,
         count(DISTINCT a.visitor)::integer,
         coalesce(sum(a.watch_ms), 0)::bigint,
         coalesce(sum(a.rebuffer_ms), 0)::bigint,
         coalesce(sum(a.rebuffer_count), 0)::integer,
         (percentile_disc(0.50) WITHIN GROUP (ORDER BY a.startup_ms) FILTER (WHERE a.started AND a.startup_ms IS NOT NULL))::integer,
         (percentile_disc(0.95) WITHIN GROUP (ORDER BY a.startup_ms) FILTER (WHERE a.started AND a.startup_ms IS NOT NULL))::integer,
         r.curve
  FROM attempts a
  JOIN retention r ON r.video_id = a.video_id
  GROUP BY a.video_id, r.curve;
END
$$;

-- Retention: raw rows older than p_raw_days (whole partitions are dropped, the rest deleted),
-- aggregates older than p_aggregate_months, job_run older than p_job_days, every salt of a past day.
-- SECURITY DEFINER for DROP TABLE (needs the owner); returns the number of dropped partitions.
CREATE OR REPLACE FUNCTION telemetry.apply_retention(
  p_raw_days         integer DEFAULT 90,
  p_aggregate_months integer DEFAULT 25,
  p_job_days         integer DEFAULT 400
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = telemetry, pg_temp
AS $$
DECLARE
  cutoff  timestamptz := now() - make_interval(days => p_raw_days);
  part    record;
  dropped integer := 0;
  month   date;
BEGIN
  FOR part IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'telemetry'
      AND p.relname IN ('page_view', 'web_vital', 'playback')
      AND c.relname ~ '_[0-9]{6}$'
  LOOP
    month := to_date(right(part.relname, 6), 'YYYYMM');
    IF ((month + interval '1 month')::timestamp AT TIME ZONE 'UTC') <= cutoff THEN
      EXECUTE format('DROP TABLE telemetry.%I', part.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;

  DELETE FROM telemetry.page_view WHERE ts < cutoff;
  DELETE FROM telemetry.web_vital WHERE ts < cutoff;
  DELETE FROM telemetry.playback  WHERE ts < cutoff;

  DELETE FROM telemetry.r_traffic_daily WHERE day < (current_date - make_interval(months => p_aggregate_months))::date;
  DELETE FROM telemetry.r_vitals_daily  WHERE day < (current_date - make_interval(months => p_aggregate_months))::date;
  DELETE FROM telemetry.r_video_daily   WHERE day < (current_date - make_interval(months => p_aggregate_months))::date;

  DELETE FROM telemetry.job_run WHERE started_at < now() - make_interval(days => p_job_days);
  DELETE FROM telemetry.daily_salt WHERE day < (now() AT TIME ZONE 'Europe/Warsaw')::date;
  RETURN dropped;
END
$$;

SELECT telemetry.ensure_partitions();

-- ---------------------------------------------------------------------------------------------
-- Privileges: pp_collector works only inside "telemetry"; pp_analytics_ro only reads it.
-- ---------------------------------------------------------------------------------------------

REVOKE ALL ON SCHEMA telemetry FROM PUBLIC;
REVOKE ALL ON FUNCTION telemetry.ensure_partitions(date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION telemetry.apply_retention(integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION telemetry.rollup_day(date) FROM PUBLIC;

GRANT USAGE ON SCHEMA telemetry TO pp_collector, pp_analytics_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA telemetry TO pp_collector;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA telemetry TO pp_collector;
GRANT EXECUTE ON FUNCTION telemetry.ensure_partitions(date, integer) TO pp_collector;
GRANT EXECUTE ON FUNCTION telemetry.apply_retention(integer, integer, integer) TO pp_collector;
GRANT EXECUTE ON FUNCTION telemetry.rollup_day(date) TO pp_collector;
GRANT SELECT ON ALL TABLES IN SCHEMA telemetry TO pp_analytics_ro;
-- With the day's salt anyone could test IP addresses against the visitor hashes: readers never see it.
REVOKE ALL ON telemetry.daily_salt FROM pp_analytics_ro;
ALTER ROLE pp_analytics_ro SET statement_timeout = '5s';
ALTER ROLE pp_collector SET statement_timeout = '60s';
