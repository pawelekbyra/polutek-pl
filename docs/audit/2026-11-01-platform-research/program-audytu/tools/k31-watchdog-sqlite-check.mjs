/* Reproducible K31 SQL probe: actual Worker code with local SQLite and synthetic fetch only. */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../../../../workers/pp-watchdog/worker.mjs';

const sqlite = new DatabaseSync(':memory:');
let batchTail = Promise.resolve();
let failNextAcceptanceBatchAfterFirst = false;
const DB = {
  prepare(sql) {
    let args = [];
    return {
      sql,
      bind(...values) { args = values; return this; },
      first() { return sqlite.prepare(sql).get(...args) ?? null; },
      all() { return { results: sqlite.prepare(sql).all(...args) }; },
      run() { return sqlite.prepare(sql).run(...args); },
    };
  },
  batch(statements) {
    const transaction = batchTail.then(async () => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const [index, statement] of statements.entries()) {
          results.push(await statement.run());
          if (failNextAcceptanceBatchAfterFirst && index === 0 && statement.sql.includes("status = 'SENT'")) {
            failNextAcceptanceBatchAfterFirst = false;
            throw new Error('synthetic D1 commit failure after provider acceptance');
          }
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    });
    batchTail = transaction.then(() => undefined, () => undefined);
    return transaction;
  },
};
const env = {
  DB,
  PING_TOKEN: 'synthetic-token',
  RESEND_API_KEY: 'synthetic-provider-key',
  ALERT_FROM: 'research@example.invalid',
  ALERT_TO: 'research@example.invalid',
};
const request = () => new Request('https://watchdog.example.invalid/run', {
  method: 'POST',
  headers: { authorization: 'Bearer synthetic-token' },
});
const oldFetch = globalThis.fetch;
let providerCalls = 0;
const providerIdempotencyKeys = [];

try {
  const schemaResponse = await worker.fetch(new Request('https://watchdog.example.invalid/status', {
    headers: { authorization: 'Bearer synthetic-token' },
  }), env);
  assert.equal(schemaResponse.status, 200);
  const now = Date.now();
  const incidentSince = now - 600_000;
  sqlite.prepare('INSERT INTO ping (source, at, status, warn_since) VALUES (?, ?, ?, ?)')
    .run('serwerek', now, 'OK', null);
  sqlite.prepare('INSERT INTO check_state VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('www', 1, 0, incidentSince, null, 'HTTP 200', now - 10_000);
  sqlite.prepare(`INSERT INTO alert_delivery
    (id, check_name, kind, subject, body, status, attempts, created_at, retry_at)
    VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`)
    .run('sqlite-probe:recovery', 'www', 'RECOVERY', '[pp-watchdog] OK again: www', 'Recovered', now - 1000, now - 1000);

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://www.pawelperfect.com/api/health') return new Response('{}', { status: 200 });
    if (url === 'https://video.pawelperfect.com/') return new Response(null, { status: 404 });
    if (url === 'https://support.pawelperfect.com/') {
      return new Response(null, { status: 302, headers: { location: 'https://example.cloudflareaccess.com/login' } });
    }
    if (url === 'https://api.resend.com/emails') {
      providerCalls += 1;
      providerIdempotencyKeys.push(new Headers(init?.headers).get('idempotency-key'));
      return new Response('{}', { status: 200 });
    }
    throw new Error(`Unexpected network boundary: ${url}`);
  };

  await Promise.all([worker.fetch(request(), env), worker.fetch(request(), env)]);
  const delivery = sqlite.prepare('SELECT status, attempts, sent_at FROM alert_delivery WHERE id = ?')
    .get('sqlite-probe:recovery');
  const dailyCount = sqlite.prepare('SELECT sent FROM alert_day').get()?.sent ?? 0;
  assert.equal(providerCalls, 1);
  assert.equal(delivery.status, 'SENT');
  assert.equal(dailyCount, 1);

  const retryId = 'sqlite-probe:ambiguous-recovery';
  sqlite.prepare(`INSERT INTO alert_delivery
    (id, check_name, kind, subject, body, status, attempts, created_at, retry_at)
    VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`).run(
    retryId, 'www', 'RECOVERY', '[pp-watchdog] OK again: www', 'Recovered', now, now,
  );
  failNextAcceptanceBatchAfterFirst = true;
  await assert.rejects(worker.fetch(request(), env), /synthetic D1 commit failure/);
  const pendingAfterRollback = sqlite.prepare('SELECT status FROM alert_delivery WHERE id = ?').get(retryId);
  assert.equal(pendingAfterRollback.status, 'PENDING');
  assert.equal(sqlite.prepare('SELECT sent FROM alert_day').get().sent, 1);
  sqlite.prepare('UPDATE alert_delivery SET lease_until = 0 WHERE id = ?').run(retryId);
  await worker.fetch(request(), env);
  const retryDelivery = sqlite.prepare('SELECT status FROM alert_delivery WHERE id = ?').get(retryId);
  assert.equal(retryDelivery.status, 'SENT');
  assert.equal(sqlite.prepare('SELECT sent FROM alert_day').get().sent, 2);
  assert.equal(providerIdempotencyKeys.filter((key) => key === retryId).length, 2);

  console.log(JSON.stringify({
    sqlite: sqlite.prepare('SELECT sqlite_version() AS version').get().version,
    actualWorkerCode: true,
    concurrentRuns: 2,
    providerStubCalls: providerCalls,
    failedAcceptanceBatchRolledBack: pendingAfterRollback.status === 'PENDING',
    retryUsesSameIdempotencyKey: providerIdempotencyKeys.filter((key) => key === retryId).length === 2,
    deliveryStatus: delivery.status,
    dailySentCountFinal: sqlite.prepare('SELECT sent FROM alert_day').get().sent,
    updateReturningSupported: true,
    externalCalls: 0,
  }));
} finally {
  globalThis.fetch = oldFetch;
  sqlite.close();
}
