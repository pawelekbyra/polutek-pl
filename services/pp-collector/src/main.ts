/**
 * pp-collector: receives analytics beacons forwarded by the www app (POST /api/t), turns them into
 * anonymous rows (processBeacon) and writes them to Postgres schema "telemetry" in batches every
 * ~2 s. Also runs the telemetry rollup (every 5 min) and retention (every 6 h).
 *
 * Reachable only inside the compose network (no published port); the app is its only client.
 * Fail-open everywhere: a broken collector loses statistics, never a page.
 * Docs: docs/architecture/admin-telemetry.md, runbook docs/operations/SERWEREK.md ("Telemetria").
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { hostname } from 'node:os';
import { BEACON_MAX_BYTES } from '../../../lib/telemetry/beacon-constants';
import { CLOUDFLARE_POLL_INTERVAL_MS, collectCloudflareSnapshots } from './cloudflare';
import { RowBuffer } from './buffer';
import { createSaltStore, createSql, insertRows } from './db';
import { processBeacon } from './handler';
import { RETENTION_INTERVAL_MS, ROLLUP_INTERVAL_MS, runExclusive, runRetention, runRollup } from './maintenance';
import { TokenBucketLimiter } from './rate-limit';
import { SaltCache } from './visitor';

const databaseUrl = process.env.TELEMETRY_DATABASE_URL;
if (!databaseUrl) {
  console.error('[pp-collector] TELEMETRY_DATABASE_URL is not set');
  process.exit(1);
}
const port = Number(process.env.PORT || 3200);
const flushIntervalMs = Number(process.env.FLUSH_INTERVAL_MS || 2000);
const allowedHosts = (process.env.TELEMETRY_ALLOWED_HOSTS || 'www.pawelperfect.com')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const host = hostname();

const sql = createSql(databaseUrl);
const salts = new SaltCache(createSaltStore(sql));
const limiter = new TokenBucketLimiter();
const buffer = new RowBuffer();
const stats = { accepted: 0, inserted: 0, insertErrors: 0, rejected: {} as Record<string, number> };

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BEACON_MAX_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

function reply(res: ServerResponse, status: number, body?: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function handleBeacon(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  if (body === null) return reply(res, 413);
  let salt: Buffer;
  try {
    salt = await salts.get(new Date());
  } catch (error) {
    console.error('[pp-collector] salt unavailable', error instanceof Error ? error.message : error);
    return reply(res, 503);
  }
  const outcome = processBeacon(
    {
      body,
      ip: header(req, 'x-pp-client-ip'),
      userAgent: header(req, 'user-agent'),
      country: header(req, 'x-pp-country'),
      origin: header(req, 'x-pp-origin'),
      referer: header(req, 'x-pp-referer'),
      doNotTrack: header(req, 'x-pp-dnt') === '1',
    },
    salt,
    new Date(),
    { allowedHosts, take: (key, nowMs) => limiter.take(key, nowMs) },
  );
  if (outcome.reason === 'accepted') {
    stats.accepted += 1;
    if (!buffer.add(outcome.rows)) stats.rejected.buffer_full = (stats.rejected.buffer_full ?? 0) + 1;
  } else {
    stats.rejected[outcome.reason] = (stats.rejected[outcome.reason] ?? 0) + 1;
  }
  reply(res, outcome.status);
}

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?', 1)[0];
  if (req.method === 'GET' && path === '/healthz') return reply(res, 200, 'ok');
  if (req.method === 'POST' && path === '/api/t') {
    handleBeacon(req, res).catch((error) => {
      console.error('[pp-collector] beacon error', error instanceof Error ? error.message : error);
      if (!res.headersSent) reply(res, 500);
    });
    return;
  }
  reply(res, 404);
});
server.requestTimeout = 10_000;
server.headersTimeout = 5_000;

let flushing = false;
async function flush() {
  if (flushing || buffer.size === 0) return;
  flushing = true;
  const rows = buffer.drain();
  try {
    stats.inserted += await insertRows(sql, rows);
  } catch (error) {
    stats.insertErrors += 1;
    console.error('[pp-collector] insert failed, retrying next tick', error instanceof Error ? error.message : error);
    if (!buffer.add(rows)) console.error('[pp-collector] buffer full, rows dropped');
  } finally {
    flushing = false;
  }
}

async function safely(name: string, job: () => Promise<void>) {
  try {
    if (!(await runExclusive(name, job))) console.warn(`[pp-collector] ${name} still running, tick skipped`);
  } catch (error) {
    console.error(`[pp-collector] ${name} failed`, error instanceof Error ? error.message : error);
  }
}

const timers = [
  setInterval(() => void flush(), flushIntervalMs),
  setInterval(() => void safely('rollup', () => runRollup(sql, host)), ROLLUP_INTERVAL_MS),
  setInterval(() => void safely('retention', () => runRetention(sql, host)), RETENTION_INTERVAL_MS),
  setInterval(() => void safely('cloudflare-analytics', async () => { await collectCloudflareSnapshots(sql, host); }), CLOUDFLARE_POLL_INTERVAL_MS),
  setInterval(() => {
    if (stats.accepted || stats.insertErrors || Object.keys(stats.rejected).length) {
      console.log(JSON.stringify({ msg: 'pp-collector stats', ...stats, buffered: buffer.size, dropped: buffer.dropped }));
      stats.accepted = 0;
      stats.inserted = 0;
      stats.insertErrors = 0;
      stats.rejected = {};
    }
  }, 60_000),
];

void safely('retention', () => runRetention(sql, host))
  .then(() => safely('rollup', () => runRollup(sql, host)))
  .then(() => safely('cloudflare-analytics', async () => { await collectCloudflareSnapshots(sql, host); }));

server.listen(port, '0.0.0.0', () => console.log(`[pp-collector] listening on :${port}, hosts ${allowedHosts.join(',')}`));

async function shutdown(signal: string) {
  console.log(`[pp-collector] ${signal}: flushing and stopping`);
  timers.forEach(clearInterval);
  server.close();
  await flush();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
