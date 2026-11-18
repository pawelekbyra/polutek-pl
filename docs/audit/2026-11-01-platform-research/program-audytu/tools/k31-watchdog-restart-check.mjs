/* Exercises the real watchdog Worker across two processes using a persistent local SQLite file and synthetic fetch. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);

if (process.env.K31_CHILD_PHASE) {
  await runChild();
} else {
  await runParent();
}

async function runChild() {
  const { default: worker } = await import('../../../../../workers/pp-watchdog/worker.mjs');
  const phase = process.env.K31_CHILD_PHASE;
  const now = Number(process.env.K31_NOW);
  const dbPath = process.env.K31_DB_PATH;
  const sqlite = new DatabaseSync(dbPath);
  const DB = createD1Adapter(sqlite);
  const providerCalls = [];
  Date.now = () => now;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://www.pawelperfect.com/api/health') return new Response('{}', { status: 200 });
    if (url === 'https://video.pawelperfect.com/') return new Response(null, { status: 404 });
    if (url === 'https://support.pawelperfect.com/') {
      return new Response(null, { status: 302, headers: { location: 'https://example.cloudflareaccess.com/login' } });
    }
    if (url === 'https://api.resend.com/emails') {
      providerCalls.push(new Headers(init?.headers).get('idempotency-key'));
      return phase === 'failure' ? new Response('{}', { status: 503 }) : new Response('{}', { status: 200 });
    }
    throw new Error(`Unexpected network boundary: ${url}`);
  };

  try {
    const response = await worker.fetch(new Request('https://watchdog.example.invalid/run', {
      method: 'POST',
      headers: { authorization: 'Bearer synthetic-token' },
    }), {
      DB,
      PING_TOKEN: 'synthetic-token',
      RESEND_API_KEY: 'synthetic-provider-key',
      ALERT_FROM: 'research@example.invalid',
      ALERT_TO: 'research@example.invalid',
    });
    process.stdout.write(`${JSON.stringify({ phase, status: response.status, providerCalls })}\n`);
  } finally {
    sqlite.close();
  }
}

async function runParent() {
  const baseTime = 1_800_000_000_000;
  const deliveryId = `restart-recovery:${baseTime}:recovery`;
  const directory = mkdtempSync(join(tmpdir(), 'k31-watchdog-restart-'));
  const dbPath = join(directory, 'watchdog.sqlite');
  try {
    const sqlite = new DatabaseSync(dbPath);
    sqlite.exec(`
      CREATE TABLE ping (source TEXT PRIMARY KEY, at INTEGER NOT NULL, status TEXT NOT NULL, warn_since INTEGER);
      CREATE TABLE alert_day (day TEXT PRIMARY KEY, sent INTEGER NOT NULL);
      CREATE TABLE alert_delivery (
        id TEXT PRIMARY KEY, check_name TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'SENT')), attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, retry_at INTEGER NOT NULL, lease_until INTEGER, sent_at INTEGER, last_error TEXT
      );
    `);
    sqlite.prepare('INSERT INTO ping (source, at, status, warn_since) VALUES (?, ?, ?, ?)')
      .run('serwerek', baseTime, 'OK', null);
    sqlite.prepare(`INSERT INTO alert_delivery
      (id, check_name, kind, subject, body, status, attempts, created_at, retry_at)
      VALUES (?, 'www', 'RECOVERY', '[pp-watchdog] OK again: www', 'Recovered', 'PENDING', 0, ?, ?)`)
      .run(deliveryId, baseTime, baseTime);
    sqlite.close();

    const firstProcess = runProcess('failure', baseTime, dbPath);
    const afterFailure = readDelivery(dbPath, deliveryId);
    assert.deepEqual(firstProcess.providerCalls, [deliveryId]);
    assert.equal(afterFailure.status, 'PENDING');
    assert.equal(afterFailure.attempts, 1);
    assert.equal(afterFailure.last_error, 'http-503');
    assert.equal(afterFailure.lease_until, null);
    assert.equal(afterFailure.retry_at, baseTime + 5 * 60_000);

    const restartedProcess = runProcess('success', baseTime + 6 * 60_000, dbPath);
    const afterRestart = readDelivery(dbPath, deliveryId);
    const resultDb = new DatabaseSync(dbPath);
    const dailyCount = resultDb.prepare('SELECT sent FROM alert_day').get()?.sent ?? 0;
    resultDb.close();
    assert.deepEqual(restartedProcess.providerCalls, [deliveryId]);
    assert.equal(afterRestart.status, 'SENT');
    assert.equal(afterRestart.attempts, 1);
    assert.equal(afterRestart.last_error, null);
    assert.equal(dailyCount, 1);

    console.log(JSON.stringify({
      actualWorkerCode: true,
      separateProcesses: [firstProcess.pid, restartedProcess.pid],
      durableDatabaseFileBetweenRuns: true,
      providerResponses: [503, 200],
      idempotencyKeyStableAcrossRestart: firstProcess.providerCalls[0] === restartedProcess.providerCalls[0],
      firstAttempt: { status: afterFailure.status, attempts: afterFailure.attempts, lastError: afterFailure.last_error },
      afterRestart: { status: afterRestart.status, attempts: afterRestart.attempts, dailySentCount: dailyCount },
      externalCalls: 0,
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runProcess(phase, now, dbPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, K31_CHILD_PHASE: phase, K31_NOW: String(now), K31_DB_PATH: dbPath },
    timeout: 15_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Worker child failed: ${result.stderr}`);
  const output = result.stdout.trim().split('\n').at(-1);
  const parsed = JSON.parse(output);
  assert.equal(parsed.status, 200);
  return { ...parsed, pid: result.pid };
}

function readDelivery(dbPath, id) {
  const sqlite = new DatabaseSync(dbPath);
  const delivery = sqlite.prepare('SELECT * FROM alert_delivery WHERE id = ?').get(id);
  sqlite.close();
  return delivery;
}

function createD1Adapter(sqlite) {
  return {
    prepare(sql) {
      let args = [];
      return {
        sql,
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { return sqlite.prepare(sql).run(...args); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
