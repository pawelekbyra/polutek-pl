/**
 * Analytics rollups on a real Postgres (CI job "integration-postgres", after `prisma migrate deploy`). NOT run in the
 * environment where this was written (no local Postgres): written to the pattern of telemetry.pg.test.ts and reviewed
 * by hand. Covers the wrapper around telemetry.rollup_day, Warsaw day boundaries, hourly rows, the startup histogram
 * (SQL buckets must equal the TypeScript ones), scores, idempotency and the read-only role.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createSql, insertRows } from '@/services/pp-collector/src/db';
import { processBeacon } from '@/services/pp-collector/src/handler';
import { runRollup } from '@/services/pp-collector/src/maintenance';
import { bucketOf, STARTUP_BUCKETS } from '@/lib/modules/admin-analytics/domain/histogram';
import { smoothnessScore, startupScore } from '@/lib/modules/admin-analytics/domain/qoe';

const sql = createSql(process.env.DATABASE_URL!);
const RUN = `pgan${Date.now().toString(36)}`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const policy = { allowedHosts: ['www.pawelperfect.com'], take: () => true };
const SALT = Buffer.alloc(32, 7);
const VIDEO = `${RUN}-video`;

function rows(body: unknown, ip: string, at: Date) {
  const outcome = processBeacon(
    { body: JSON.stringify(body), ip, userAgent: UA, country: 'PL', origin: 'https://www.pawelperfect.com', referer: undefined, doNotTrack: false },
    SALT,
    at,
    policy,
  );
  if (outcome.reason !== 'accepted') throw new Error(`beacon not accepted: ${outcome.reason}`);
  return outcome.rows;
}

const warsawDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(d);

afterAll(async () => {
  await sql`delete from telemetry.page_view where path like ${`/${RUN}%`}`;
  await sql`delete from telemetry.playback where video_id like ${`${RUN}%`}`;
  for (const t of ['r_video_hourly', 'r_video_qoe_daily', 'r_playback_error_daily', 'r_playback_ladder_daily', 'r_video_daily']) {
    await sql.unsafe(`delete from telemetry.${t} where video_id like '${RUN}%'`);
  }
  await sql`delete from telemetry.job_run where host = ${RUN}`;
  await sql.end();
});

describe('analytics rollups', () => {
  it('startup_histogram() puts every value in the same bucket as the TypeScript bucketOf()', async () => {
    const samples = [0, 1, 249, 250, 499, 500, 999, 1000, 1999, 2000, 2999, 3000, 7999, 8000, 19999, 20000, 90000];
    const [row] = await sql<{ h: number[] }[]>`select telemetry.startup_histogram(${samples}::int[]) as h`;
    const expected = new Array<number>(STARTUP_BUCKETS).fill(0);
    for (const s of samples) expected[bucketOf(s)]++;
    expect(row.h).toEqual(expected);
    const [empty] = await sql<{ h: number[] }[]>`select telemetry.startup_histogram(null::int[]) as h`;
    expect(empty.h).toEqual(new Array<number>(STARTUP_BUCKETS).fill(0));
  });

  it('rollup_day (called by the collector) also fills the analytics tables, hourly and daily, and is idempotent', async () => {
    const now = new Date();
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000b1', videoId: VIDEO, started: true, startupMs: 1200, watchMs: 12000, rebufferCount: 2, rebufferMs: 600, maxHeight: 720, bitrateKbps: 2500, switches: 1, watched: 'c' + '0'.repeat(24) }] }, '198.51.100.11', now));
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000b2', videoId: VIDEO, started: true, startupMs: 300, watchMs: 4000, errorCode: 'hls:networkError:x', fatalError: true }] }, '198.51.100.12', now));
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000b3', videoId: VIDEO, exitedBeforeStart: true }] }, '198.51.100.13', now));
    await insertRows(sql, rows({ v: 1, pageView: { path: `/${RUN}/a` } }, '198.51.100.11', now));
    await insertRows(sql, rows({ v: 1, pageView: { path: `/${RUN}/a` } }, '198.51.100.11', now));
    await insertRows(sql, rows({ v: 1, pageView: { path: `/${RUN}/b` } }, '198.51.100.12', now));

    for (let i = 0; i < 2; i++) await runRollup(sql, RUN, now); // twice: same result
    const day = warsawDay(now);

    const [qoe] = await sql`
      select views, rebuffered_attempts, switches, bitrate_n, startup_n, startup_hist, smoothness_n, startup_score_sum, smoothness_sum
      from telemetry.r_video_qoe_daily where day = ${day}::date and video_id = ${VIDEO}`;
    expect(qoe.views).toBe(1); // only b1 watched >= 10 s
    expect(qoe.rebuffered_attempts).toBe(1);
    expect(qoe.switches).toBe(1);
    expect(qoe.startup_n).toBe(2);
    expect(qoe.startup_hist[bucketOf(1200)]).toBe(1);
    expect(qoe.startup_hist[bucketOf(300)]).toBe(1);
    expect(qoe.smoothness_n).toBe(2);
    expect(Number(qoe.startup_score_sum)).toBeCloseTo(startupScore(1.2) + startupScore(0.3), 6);
    const ratio = 600 / (12000 + 600);
    expect(Number(qoe.smoothness_sum)).toBeCloseTo(smoothnessScore(2, ratio) + smoothnessScore(0, 0), 6);

    const [hour] = await sql`select attempts, started, views, exits_before_start, errors, fatal_errors, visitors from telemetry.r_video_hourly where video_id = ${VIDEO} and hour >= ${day}::date - 1`;
    expect(hour).toEqual({ attempts: 3, started: 2, views: 1, exits_before_start: 1, errors: 1, fatal_errors: 1, visitors: 3 });

    const errors = await sql`select error_code, attempts, fatal from telemetry.r_playback_error_daily where video_id = ${VIDEO} and day = ${day}::date`;
    expect(errors).toEqual([{ error_code: 'hls:networkError:x', attempts: 1, fatal: 1 }]);
    const ladder = await sql`select height, attempts from telemetry.r_playback_ladder_daily where video_id = ${VIDEO} and day = ${day}::date order by height`;
    expect(ladder).toEqual([{ height: 0, attempts: 1 }, { height: 720, attempts: 1 }]);

    const [extra] = await sql`select visitors, single_view_visitors from telemetry.r_traffic_extra_daily where day = ${day}::date`;
    expect(Number(extra.visitors)).toBeGreaterThanOrEqual(2);
    expect(Number(extra.single_view_visitors)).toBeGreaterThanOrEqual(1);

    // the pre-existing rollup is untouched by the wrapper
    const [old] = await sql`select attempts, started from telemetry.r_video_daily where day = ${day}::date and video_id = ${VIDEO}`;
    expect(old).toEqual({ attempts: 3, started: 2 });
  });

  it('assigns a beacon just after Warsaw midnight to the Warsaw day, not the UTC day', async () => {
    // 22:30 UTC on a summer date is 00:30 the next day in Warsaw (UTC+2).
    const at = new Date('2026-07-01T22:30:00Z');
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000c1', videoId: VIDEO, started: true, startupMs: 800, watchMs: 11000 }] }, '198.51.100.21', at));
    await sql`select telemetry.rollup_analytics_day('2026-07-02'::date)`;
    await sql`select telemetry.rollup_analytics_day('2026-07-01'::date)`;
    const [next] = await sql`select views from telemetry.r_video_qoe_daily where day = '2026-07-02'::date and video_id = ${VIDEO}`;
    expect(next?.views).toBe(1);
    const same = await sql`select views from telemetry.r_video_qoe_daily where day = '2026-07-01'::date and video_id = ${VIDEO}`;
    expect(same).toHaveLength(0);
    const [h] = await sql`select hour from telemetry.r_video_hourly where video_id = ${VIDEO} and hour = '2026-07-01T22:00:00Z'`;
    expect(h).toBeDefined();
  });

  it('the read-only role reads the new tables, cannot write, and still cannot read the salt', async () => {
    const [ro] = await sql<{ select_ok: boolean; insert_ok: boolean; salt_ok: boolean }[]>`
      select has_table_privilege('pp_analytics_ro', 'telemetry.r_video_qoe_daily', 'SELECT') as select_ok,
             has_table_privilege('pp_analytics_ro', 'telemetry.r_video_qoe_daily', 'INSERT') as insert_ok,
             has_table_privilege('pp_analytics_ro', 'telemetry.daily_salt', 'SELECT') as salt_ok`;
    expect(ro).toEqual({ select_ok: true, insert_ok: false, salt_ok: false });
    const [fn] = await sql<{ ok: boolean }[]>`select has_function_privilege('pp_analytics_ro', 'telemetry.rollup_day(date)', 'EXECUTE') as ok`;
    expect(fn.ok).toBe(false);
  });
});
