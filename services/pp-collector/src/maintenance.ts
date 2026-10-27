import { TELEMETRY_AGGREGATE_RETENTION_MONTHS, TELEMETRY_RAW_RETENTION_DAYS } from '../../../lib/telemetry/retention';
import { recordJobRun, type Sql } from './db';
import { warsawDay } from './visitor';

export const ROLLUP_INTERVAL_MS = 5 * 60 * 1000;
export const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;

const running = new Set<string>();

/**
 * Runs `job` unless the previous run of the same `name` is still going (W23): a rollup that takes longer than its
 * interval must not pile up behind itself on the collector's tiny connection pool and starve the beacon inserts.
 * Returns false when the tick was skipped.
 */
export async function runExclusive(name: string, job: () => Promise<void>): Promise<boolean> {
  if (running.has(name)) return false;
  running.add(name);
  try {
    await job();
    return true;
  } finally {
    running.delete(name);
  }
}

function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Days whose aggregates a rollup at `now` rebuilds: today and yesterday (late beacons, midnight). */
export function rollupDays(now: Date): [string, string] {
  const today = warsawDay(now);
  return [previousDay(today), today];
}

/** Rebuilds today's and yesterday's daily aggregates and records the run in job_run. */
export async function runRollup(sql: Sql, host: string, now = new Date()): Promise<void> {
  const startedAt = new Date();
  const days = rollupDays(now);
  try {
    for (const day of days) await sql`select telemetry.rollup_day(${day}::date)`;
    await recordJobRun(sql, 'telemetry-rollup', startedAt, 'ok', `days ${days.join(',')}`, host);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun(sql, 'telemetry-rollup', startedAt, 'fail', message, host).catch(() => {});
    throw error;
  }
}

/** Creates upcoming monthly partitions and applies the retention limits (lib/telemetry/retention.ts). */
export async function runRetention(sql: Sql, host: string): Promise<void> {
  const startedAt = new Date();
  try {
    const [created] = await sql<{ n: number }[]>`select telemetry.ensure_partitions() as n`;
    const [dropped] = await sql<{ n: number }[]>`
      select telemetry.apply_retention(${TELEMETRY_RAW_RETENTION_DAYS}::int, ${TELEMETRY_AGGREGATE_RETENTION_MONTHS}::int) as n`;
    await recordJobRun(
      sql,
      'telemetry-retention',
      startedAt,
      'ok',
      `partitions created ${created?.n ?? 0}, dropped ${dropped?.n ?? 0}`,
      host,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun(sql, 'telemetry-retention', startedAt, 'fail', message, host).catch(() => {});
    throw error;
  }
}
