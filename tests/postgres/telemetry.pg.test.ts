/**
 * Telemetry schema on a real Postgres (CI job "integration-postgres", after `prisma migrate deploy`):
 * the collector's batch insert and salt store, the SQL rollups, retention and the role boundaries
 * (pp_collector never reaches the domain tables, pp_analytics_ro only reads and never sees the salt).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createSaltStore, createSql, insertRows } from '@/services/pp-collector/src/db';
import { processBeacon } from '@/services/pp-collector/src/handler';
import { runRetention, runRollup } from '@/services/pp-collector/src/maintenance';
import { warsawDay } from '@/services/pp-collector/src/visitor';

const sql = createSql(process.env.DATABASE_URL!);
const RUN = `pgtel${Date.now().toString(36)}`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const policy = { allowedHosts: ['www.pawelperfect.com'], take: () => true };
const SALT = Buffer.alloc(32, 1);

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

afterAll(async () => {
  await sql`delete from telemetry.page_view where path like ${`/${RUN}%`}`;
  await sql`delete from telemetry.playback where video_id like ${`${RUN}%`}`;
  await sql`delete from telemetry.web_vital where path like ${`/${RUN}%`}`;
  await sql`delete from telemetry.r_traffic_daily where value like ${`/${RUN}%`}`;
  await sql`delete from telemetry.r_video_daily where video_id like ${`${RUN}%`}`;
  await sql`delete from telemetry.job_run where host = ${RUN}`;
  await sql.end();
});

describe('telemetry rollups', () => {
  it('counts page views and daily visitors per path', async () => {
    const now = new Date();
    const path = `/${RUN}/home`;
    await insertRows(sql, rows({ v: 1, pageView: { path } }, '198.51.100.1', now));
    await insertRows(sql, rows({ v: 1, pageView: { path } }, '198.51.100.1', now));
    await insertRows(sql, rows({ v: 1, pageView: { path, referrer: 'https://news.example/a' } }, '198.51.100.2', now));

    await runRollup(sql, RUN, now);
    const [traffic] = await sql<{ pageviews: number; visitors: number }[]>`
      select pageviews, visitors from telemetry.r_traffic_daily
      where day = ${warsawDay(now)}::date and dimension = 'path' and value = ${path}`;
    expect(traffic).toEqual({ pageviews: 3, visitors: 2 });
    const [job] = await sql<{ status: string }[]>`select status from telemetry.job_run where host = ${RUN} and job = 'telemetry-rollup'`;
    expect(job.status).toBe('ok');
  });

  it('joins the deltas of one play attempt: sums, startup, retention curve, exits before start', async () => {
    const now = new Date();
    const video = `${RUN}-video`;
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000a1', videoId: video, started: true, startupMs: 500, watchMs: 4000, watched: 'c' + '0'.repeat(24) }] }, '198.51.100.3', now));
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000a1', videoId: video, watchMs: 6000, rebufferCount: 1, rebufferMs: 700, watched: 'e' + '0'.repeat(24) }] }, '198.51.100.3', now));
    await insertRows(sql, rows({ v: 1, playback: [{ attempt: '00000000000000a2', videoId: video, exitedBeforeStart: true }] }, '198.51.100.4', now));

    await runRollup(sql, RUN, now);
    const [daily] = await sql`
      select attempts, started, exits_before_start, visitors, watch_ms::int as watch_ms, rebuffer_ms::int as rebuffer_ms,
             rebuffer_count, startup_p50_ms, retention[1:4] as head
      from telemetry.r_video_daily where day = ${warsawDay(now)}::date and video_id = ${video}`;
    expect(daily).toEqual({
      attempts: 2,
      started: 1,
      exits_before_start: 1,
      visitors: 2,
      watch_ms: 10000,
      rebuffer_ms: 700,
      rebuffer_count: 1,
      startup_p50_ms: 500,
      head: [1, 1, 1, 0],
    });
  });
});

describe('telemetry retention', () => {
  it('drops raw rows older than 90 days, whole partitions included, and keeps recent ones', async () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const oldMonth = `${old.getUTCFullYear()}-${String(old.getUTCMonth() + 1).padStart(2, '0')}-01`;
    await sql`select telemetry.ensure_partitions(${oldMonth}::date, 1)`;
    await insertRows(sql, rows({ v: 1, pageView: { path: `/${RUN}/old` } }, '198.51.100.5', old));
    await insertRows(sql, rows({ v: 1, pageView: { path: `/${RUN}/new` } }, '198.51.100.5', new Date()));

    await runRetention(sql, RUN);
    const paths = (await sql<{ path: string }[]>`select path from telemetry.page_view where path like ${`/${RUN}/%`}`).map((r) => r.path);
    expect(paths).toContain(`/${RUN}/new`);
    expect(paths).not.toContain(`/${RUN}/old`);
    const partition = `page_view_${oldMonth.slice(0, 4)}${oldMonth.slice(5, 7)}`;
    const [exists] = await sql<{ present: boolean }[]>`select to_regclass(${`telemetry.${partition}`}) is not null as present`;
    expect(exists.present).toBe(false);
  });

  it('keeps one salt per day and deletes the older ones', async () => {
    const salts = createSaltStore(sql);
    const today = warsawDay(new Date());
    const first = await salts.getOrCreate(today);
    expect(first).toHaveLength(32);
    expect(await salts.getOrCreate(today)).toEqual(first);
    await sql`insert into telemetry.daily_salt (day, salt) values ('2020-01-01', '\\x01') on conflict do nothing`;
    await salts.deleteBefore(today);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from telemetry.daily_salt where day < ${today}::date`;
    expect(n).toBe(0);
  });
});

describe('telemetry roles', () => {
  it('pp_collector writes telemetry but cannot read domain tables', async () => {
    await expect(sql.begin(async (tx) => {
      await tx`set local role pp_collector`;
      await tx`insert into telemetry.job_run (job, status, host) values ('pg-test', 'ok', ${RUN})`;
      return (await tx`select count(*)::int as n from telemetry.r_traffic_daily`).length;
    })).resolves.toBe(1);
    await expect(sql.begin(async (tx) => {
      await tx`set local role pp_collector`;
      await tx`select count(*) from public."User"`;
    })).rejects.toThrow(/permission denied for table User/);
  });

  it('pp_analytics_ro reads aggregates but cannot write or see the salt', async () => {
    await expect(sql.begin(async (tx) => {
      await tx`set local role pp_analytics_ro`;
      await tx`select count(*) from telemetry.r_video_daily`;
      await tx`select salt from telemetry.daily_salt`;
    })).rejects.toThrow(/permission denied for table daily_salt/);
    await expect(sql.begin(async (tx) => {
      await tx`set local role pp_analytics_ro`;
      await tx`insert into telemetry.job_run (job, status) values ('x', 'ok')`;
    })).rejects.toThrow(/permission denied for table job_run/);
  });
});
