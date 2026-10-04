import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import type { BeaconRows } from './handler';
import type { SaltStore } from './visitor';

export type Sql = postgres.Sql;

/** Small pool: one connection for inserts, one for maintenance. Role pp_collector (schema telemetry only). */
export function createSql(url: string): Sql {
  return postgres(url, {
    max: 2,
    idle_timeout: 60,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: 'pp-collector' },
  });
}

export async function insertRows(sql: Sql, rows: BeaconRows): Promise<number> {
  const total = rows.pageViews.length + rows.vitals.length + rows.playback.length;
  if (total === 0) return 0;
  await sql.begin(async (tx) => {
    if (rows.pageViews.length) await tx`insert into telemetry.page_view ${tx(rows.pageViews)}`;
    if (rows.vitals.length) await tx`insert into telemetry.web_vital ${tx(rows.vitals)}`;
    if (rows.playback.length) await tx`insert into telemetry.playback ${tx(rows.playback)}`;
  });
  return total;
}

export function createSaltStore(sql: Sql): SaltStore {
  return {
    async getOrCreate(day) {
      await sql`insert into telemetry.daily_salt (day, salt) values (${day}, ${randomBytes(32)}) on conflict (day) do nothing`;
      const [row] = await sql<{ salt: Buffer }[]>`select salt from telemetry.daily_salt where day = ${day}`;
      if (!row) throw new Error('salt missing after insert');
      return Buffer.from(row.salt);
    },
    async deleteBefore(day) {
      await sql`delete from telemetry.daily_salt where day < ${day}`;
    },
  };
}

/** One row in telemetry.job_run per run of a periodic job (read by the admin panel and the watchdog). */
export async function recordJobRun(
  sql: Sql,
  job: string,
  startedAt: Date,
  status: 'ok' | 'fail',
  detail: string,
  host: string,
): Promise<void> {
  const durationMs = Date.now() - startedAt.getTime();
  await sql`
    insert into telemetry.job_run (job, status, started_at, finished_at, duration_ms, detail, host)
    values (${job}, ${status}, ${startedAt}, now(), ${durationMs}, ${detail.slice(0, 2000)}, ${host})
  `;
}
