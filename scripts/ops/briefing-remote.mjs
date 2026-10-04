// Zbieracz danych odprawy, uruchamiany NA SERWERZE przez briefing.mjs:
//   ssh serwerek node --input-type=module - <sinceISO>   (skrypt przychodzi na stdin)
//
// TYLKO ODCZYT. Ten plik nie może niczego zmieniać:
// - baza: jedno połączenie psql na kontener, sesja READ ONLY (PGOPTIONS + SET SESSION
//   CHARACTERISTICS), limit czasu zapytania, same SELECT z LIMIT;
// - Docker/systemd/journal: wyłącznie polecenia listujące (ps, stats, logs, list-timers, show);
// - PP Support: wyłącznie GET na lokalnym API tokenem agenta (token czytany z pliku, nigdy wypisywany);
// - Redis: SCAN + MGET.
// Wynik: jeden JSON na stdout. Błąd jednego zbieracza nie przerywa pozostałych.
// Treść od ludzi (maile, komentarze, logi) wychodzi stąd surowa, ale ucięta; czyszczenie i
// oznaczanie [NIEZAUFANE] robi briefing-lib.mjs po stronie komputera właściciela.

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';

const SINCE = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(a));
if (!SINCE) {
  process.stdout.write(JSON.stringify({ fatal: 'brak poprawnego argumentu since (ISO UTC)' }));
  process.exit(2);
}
const SINCE_MS = Date.parse(SINCE);
const SINCE_EPOCH = Math.floor(SINCE_MS / 1000);
const LOG_SINCE_EPOCH = Math.min(SINCE_EPOCH, Math.floor(Date.now() / 1000) - 24 * 3600);

const APP_DB = 'polutek-db-1';
const APP = 'polutek-app-1';
const ENCODER = 'polutek-encoder-1';
const REDIS = 'polutek-redis-1';
const SUPPORT_API = 'http://127.0.0.1:3010';
const SUPPORT_TOKEN_FILE = '/opt/serwerek/secrets/pp-support-ai-agent.token';
const BACKUP_DIR = '/opt/serwerek/backups';
const LOG_DIR = '/var/log/serwerek';

function run(cmd, args, { timeout = 15000, input, maxBuffer = 8 * 1024 * 1024 } = {}) {
  return execFileSync(cmd, args, { timeout, input, maxBuffer, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function cut(text, max) {
  if (typeof text !== 'string') return text ?? null;
  return text.length > max ? text.slice(0, max) : text;
}

function tailFile(path, lines) {
  const content = readFileSync(path, 'utf8');
  return content.split('\n').filter(Boolean).slice(-lines);
}

async function getJson(url, headers = {}, timeoutMs = 10000) {
  const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: res.status, body };
}

// ---------------------------------------------------------------- host, docker, systemd

function collectHost() {
  const meminfo = Object.fromEntries(
    readFileSync('/proc/meminfo', 'utf8').split('\n').filter(Boolean).map((line) => {
      const [key, rest] = line.split(':');
      return [key.trim(), Number.parseInt(rest, 10) * 1024];
    }),
  );
  const df = run('df', ['-B1', '--output=size,used,avail,pcent', '/']).trim().split('\n')[1].trim().split(/\s+/);
  return {
    hostname: os.hostname(),
    uptimeSeconds: Math.round(os.uptime()),
    load: os.loadavg(),
    cpus: os.cpus().length,
    memTotal: meminfo.MemTotal,
    memAvailable: meminfo.MemAvailable,
    swapTotal: meminfo.SwapTotal,
    swapUsed: meminfo.SwapTotal - meminfo.SwapFree,
    diskSize: Number(df[0]),
    diskUsed: Number(df[1]),
    diskAvail: Number(df[2]),
    diskPercent: Number.parseInt(df[3], 10),
  };
}

function collectDocker() {
  const ps = run('docker', ['ps', '-a', '--format', '{{json .}}']).split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .map((c) => ({ name: c.Names, image: c.Image, state: c.State, status: c.Status }));
  let stats = [];
  try {
    stats = run('docker', ['stats', '--no-stream', '--format', '{{json .}}'], { timeout: 20000 })
      .split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .map((s) => ({ name: s.Name, cpu: s.CPUPerc, mem: s.MemUsage, memPercent: s.MemPerc }));
  } catch (error) {
    stats = { error: String(error.message).slice(0, 200) };
  }
  const started = {};
  for (const name of [APP, ENCODER]) {
    try { started[name] = run('docker', ['inspect', '-f', '{{.State.StartedAt}}', name]).trim(); } catch { /* brak kontenera */ }
  }
  return { containers: ps, stats, started };
}

function collectTimers() {
  const timers = JSON.parse(run('systemctl', ['list-timers', 'polutek-cron-*', '--all', '--output=json']));
  const units = run('systemctl', ['list-units', 'polutek-cron@*', '--all', '--no-legend', '--plain'])
    .split('\n').filter(Boolean).map((l) => l.split(/\s+/)[0]);
  const results = [];
  if (units.length) {
    const out = run('systemctl', ['show', ...units, '-p', 'Id,Result,ExecMainStatus,ExecMainExitTimestamp,ActiveState']);
    for (const block of out.split('\n\n')) {
      const entry = Object.fromEntries(block.split('\n').filter(Boolean).map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }));
      if (entry.Id) results.push(entry);
    }
  }
  let failed = [];
  try {
    failed = JSON.parse(run('systemctl', ['--failed', '--output=json'])).map((u) => u.unit);
  } catch { /* starsze systemd */ }
  return {
    timers: timers.map((t) => ({ unit: t.unit, activates: t.activates, last: t.last ? Math.round(t.last / 1000) : null, next: t.next ? Math.round(t.next / 1000) : null })),
    units: results,
    failedUnits: failed,
  };
}

function collectJournal() {
  // Tylko błędy (priorytet err i wyżej) z ostatnich 24 h albo od ostatniej odprawy; same komunikaty, ucięte.
  const out = run('journalctl', ['--since', `@${LOG_SINCE_EPOCH}`, '-p', 'err', '--no-pager', '-o', 'json', '-n', '3000',
    '--output-fields=MESSAGE,_SYSTEMD_UNIT,SYSLOG_IDENTIFIER'], { timeout: 20000 });
  const entries = out.split('\n').filter(Boolean).map((l) => {
    try {
      const e = JSON.parse(l);
      const msg = Array.isArray(e.MESSAGE) ? '(binarne)' : String(e.MESSAGE ?? '');
      return { unit: e._SYSTEMD_UNIT || e.SYSLOG_IDENTIFIER || '?', msg: cut(msg, 200) };
    } catch { return null; }
  }).filter(Boolean);
  const cron = run('journalctl', ['-u', 'polutek-cron@*', '--since', `@${LOG_SINCE_EPOCH}`, '-p', 'warning', '--no-pager', '-o', 'cat', '-n', '200'])
    .split('\n').filter(Boolean).map((l) => cut(l, 200));
  return { entries, cron };
}

function collectLogs() {
  const result = {};
  for (const name of [APP, ENCODER]) {
    try {
      // docker logs pisze stdout i stderr; execFileSync zwraca tylko stdout, więc łączymy przez sh.
      const all = run('sh', ['-c', `docker logs --since ${LOG_SINCE_EPOCH} ${name} 2>&1 | tail -n 20000`], { timeout: 20000, maxBuffer: 64 * 1024 * 1024 });
      const lines = all.split('\n').filter(Boolean);
      const problems = lines.filter((l) => /\b(error|fatal|exception|unhandled|warn)\b/i.test(l)).slice(-1500).map((l) => cut(l, 300));
      result[name] = { totalLines: lines.length, problems };
    } catch (error) {
      result[name] = { error: String(error.message).slice(0, 200) };
    }
  }
  return result;
}

function collectBackups() {
  const files = readdirSync(BACKUP_DIR).map((name) => {
    const st = statSync(`${BACKUP_DIR}/${name}`);
    return { name, size: st.size, mtime: st.mtimeMs, isFile: st.isFile() };
  }).filter((f) => f.isFile);
  const newest = {};
  for (const prefix of ['pg-polutek-db-1-', 'pg-pp-support-db-1-', 'configs-', 'pp-support-storage-', 'pre-deploy-']) {
    const match = files.filter((f) => f.name.startsWith(prefix)).sort((a, b) => b.mtime - a.mtime)[0];
    newest[prefix.replace(/-$/, '')] = match ? { name: match.name, size: match.size, mtime: Math.round(match.mtime) } : null;
  }
  const log = tailFile(`${LOG_DIR}/backup.log`, 80);
  const startIdx = log.map((l, i) => (l.startsWith('== ') && l.includes(' start') ? i : -1)).filter((i) => i >= 0).pop();
  const lastRun = startIdx === undefined ? [] : log.slice(startIdx);
  const failLine = lastRun.find((l) => /^== done fail=/.test(l));
  return {
    newest,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
    lastRun: {
      started: lastRun[0] ?? null,
      done: Boolean(failLine),
      fail: failLine ? Number(failLine.split('fail=')[1]) : null,
      r2Ok: lastRun.some((l) => /r2 upload ok/.test(l)),
    },
  };
}

function collectHealthLogs() {
  const health = tailFile(`${LOG_DIR}/health.log`, 1);
  let alerts = [];
  try {
    alerts = tailFile(`${LOG_DIR}/alerts.log`, 200).filter((l) => {
      const t = Date.parse(l.slice(0, 25));
      return Number.isFinite(t) && t >= SINCE_MS;
    }).slice(-30);
  } catch { /* brak pliku */ }
  let changes = [];
  try {
    changes = tailFile(`${LOG_DIR}/changes.log`, 400).filter((l) => {
      const t = Date.parse(l.slice(0, 25));
      return Number.isFinite(t) && t >= SINCE_MS;
    });
  } catch { /* brak pliku */ }
  let fail2ban = null;
  try {
    const out = run('fail2ban-client', ['status', 'sshd']);
    fail2ban = {
      currentlyBanned: Number((out.match(/Currently banned:\s*(\d+)/) || [])[1] ?? NaN),
      totalBanned: Number((out.match(/Total banned:\s*(\d+)/) || [])[1] ?? NaN),
    };
  } catch { /* brak fail2ban */ }
  return { lastHealth: health[0] ?? null, alerts, changesCount: changes.length, changesTail: changes.slice(-5).map((l) => cut(l, 200)), fail2ban };
}

async function collectHttpHealth() {
  const app = await getJson('http://127.0.0.1:3000/api/health');
  const support = await getJson(`${SUPPORT_API}/api`);
  return {
    app: { status: app.status, ok: app.body?.ok === true },
    support: {
      status: support.status,
      version: support.body?.version ?? null,
      queue: support.body?.queue_services ?? null,
      data: support.body?.data_services ?? null,
    },
  };
}

// ---------------------------------------------------------------- baza aplikacji (READ ONLY)

const SQL = String.raw`
\set QUIET on
\pset tuples_only on
\pset format unaligned
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SET statement_timeout = '5s';
SET lock_timeout = '1s';
SET TIME ZONE 'UTC';
SELECT text '@@meta ' || jsonb_build_object(
  'readOnly', current_setting('transaction_read_only'),
  'user', current_user,
  'superuser', (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),
  'dbSizeBytes', pg_database_size(current_database()),
  'now', now());
SELECT text '@@comments ' || jsonb_build_object(
  'newCount', (SELECT count(*) FROM "Comment" WHERE "createdAt" >= :'since'::timestamptz),
  'heldCount', (SELECT count(*) FROM "Comment" WHERE status = 'HELD_FOR_REVIEW'),
  'newest', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT c.id, c."createdAt", c.status, (c."parentId" IS NOT NULL) AS "isReply", left(c.text, 1500) AS text,
           u.name AS author, (u.role = 'ADMIN') AS "authorIsAdmin", v.slug AS "videoSlug", v.title AS "videoTitle"
    FROM "Comment" c JOIN "User" u ON u.id = c."authorId" JOIN "Video" v ON v.id = c."videoId"
    WHERE c."createdAt" >= :'since'::timestamptz
    ORDER BY c."createdAt" DESC LIMIT 25) t),
  'held', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT c.id, c."createdAt", left(c.text, 1500) AS text, c."reportsCount", u.name AS author, v.slug AS "videoSlug", v.title AS "videoTitle"
    FROM "Comment" c JOIN "User" u ON u.id = c."authorId" JOIN "Video" v ON v.id = c."videoId"
    WHERE c.status = 'HELD_FOR_REVIEW' ORDER BY c."createdAt" DESC LIMIT 15) t));
SELECT text '@@reports ' || jsonb_build_object(
  'pendingCount', (SELECT count(*) FROM "CommentReport" WHERE status = 'PENDING'),
  'pending', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT r.id, r."createdAt", r.reason, left(r.note, 500) AS note, r."commentId", c.status AS "commentStatus",
           left(c.text, 1500) AS "commentText", a.name AS "commentAuthor", rep.name AS reporter, v.slug AS "videoSlug", v.title AS "videoTitle"
    FROM "CommentReport" r JOIN "Comment" c ON c.id = r."commentId" JOIN "User" a ON a.id = c."authorId"
    JOIN "User" rep ON rep.id = r."reporterId" JOIN "Video" v ON v.id = c."videoId"
    WHERE r.status = 'PENDING' ORDER BY r."createdAt" DESC LIMIT 20) t));
SELECT text '@@payments ' || jsonb_build_object(
  'byStatusSince', (SELECT coalesce(json_object_agg(status, n), '{}') FROM (
    SELECT status, count(*) AS n FROM "Payment" WHERE "createdAt" >= :'since'::timestamptz GROUP BY status) s),
  'newest', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT p.id, p."createdAt", p."updatedAt", p."amountMinor", p.currency, p.status, p."refundedAmountMinor", u.name AS payer
    FROM "Payment" p JOIN "User" u ON u.id = p."userId"
    WHERE p."createdAt" >= :'since'::timestamptz OR p."updatedAt" >= :'since'::timestamptz
    ORDER BY p."createdAt" DESC LIMIT 25) t),
  'pendingOld', (SELECT json_build_object('count', count(*), 'oldest', min("createdAt")) FROM "Payment"
    WHERE status = 'PENDING' AND "createdAt" < now() - interval '1 hour'),
  'disputed', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT id, "createdAt", "updatedAt", "amountMinor", currency, status FROM "Payment"
    WHERE status IN ('DISPUTED', 'CHARGEBACK_LOST') ORDER BY "updatedAt" DESC LIMIT 10) t),
  'refundedSince', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT id, "refundedAt", "amountMinor", "refundedAmountMinor", currency, status, ("refundedById" IS NOT NULL) AS "byAdmin"
    FROM "Payment" WHERE "refundedAt" >= :'since'::timestamptz ORDER BY "refundedAt" DESC LIMIT 10) t),
  'succeededTotal', (SELECT count(*) FROM "Payment" WHERE status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED')));
SELECT text '@@stripeEvents ' || jsonb_build_object(
  'total', (SELECT count(*) FROM "StripeEvent"),
  'since', (SELECT count(*) FROM "StripeEvent" WHERE "createdAt" >= :'since'::timestamptz),
  'failedSince', (SELECT count(*) FROM "StripeEvent" WHERE status = 'FAILED' AND "createdAt" >= :'since'::timestamptz),
  'stuckProcessing', (SELECT count(*) FROM "StripeEvent" WHERE status = 'PROCESSING' AND "createdAt" < now() - interval '10 minutes'),
  'last', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT id, type, status, "createdAt", left(error, 200) AS error FROM "StripeEvent" ORDER BY "createdAt" DESC LIMIT 5) t));
SELECT text '@@users ' || jsonb_build_object(
  'total', (SELECT count(*) FROM "User" WHERE NOT "isDeleted"),
  'newCount', (SELECT count(*) FROM "User" WHERE "createdAt" >= :'since'::timestamptz),
  'newest', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT id, "createdAt", name, email, "emailVerified", "onboardingPending", role FROM "User"
    WHERE "createdAt" >= :'since'::timestamptz ORDER BY "createdAt" DESC LIMIT 20) t),
  'admins', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT u.id, u.name, u.email, u."createdAt", coalesce(u."twoFactorEnabled", false) AS "twoFactor",
           (SELECT count(*) FROM "Passkey" pk WHERE pk."userId" = u.id) AS passkeys
    FROM "User" u WHERE u.role = 'ADMIN' AND NOT u."isDeleted" ORDER BY u."createdAt" LIMIT 20) t));
SELECT text '@@audit ' || jsonb_build_object(
  'byAction', (SELECT coalesce(json_object_agg(action, n), '{}') FROM (
    SELECT action, count(*) AS n FROM "AuditLog" WHERE "createdAt" >= :'since'::timestamptz GROUP BY action) s),
  'adminChanges', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT action, "createdAt", "targetId", "actorUserId", metadata FROM "AuditLog"
    WHERE "createdAt" >= :'since'::timestamptz AND action IN ('ADMIN_USER_ROLE_CHANGED', 'AUTH_ADMIN_BOOTSTRAP')
    ORDER BY "createdAt" DESC LIMIT 10) t));
SELECT text '@@encode ' || jsonb_build_object(
  'byStatus', (SELECT coalesce(json_object_agg(status, n), '{}') FROM (
    SELECT status, count(*) AS n FROM "VideoEncodeJob" WHERE status IN ('QUEUED', 'RUNNING') OR "updatedAt" >= :'since'::timestamptz GROUP BY status) s),
  'active', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT j.id, j.status, j.stage, j."progressPercent", j."attemptCount", j."heartbeatAt", j."createdAt", v.slug AS "videoSlug"
    FROM "VideoEncodeJob" j JOIN "Video" v ON v.id = j."videoId"
    WHERE j.status IN ('QUEUED', 'RUNNING') ORDER BY j."createdAt" LIMIT 10) t),
  'failed', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT j.id, j."finishedAt", j."failureCode", left(j."failureReason", 200) AS "failureReason", j."attemptCount", v.slug AS "videoSlug"
    FROM "VideoEncodeJob" j JOIN "Video" v ON v.id = j."videoId"
    WHERE j.status = 'FAILED' AND j."updatedAt" >= :'since'::timestamptz ORDER BY j."updatedAt" DESC LIMIT 10) t));
SELECT text '@@videos ' || jsonb_build_object(
  'premieres', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT slug, title, "premiereAt", tier FROM "Video"
    WHERE status = 'PUBLISHED' AND "premiereAt" > now() ORDER BY "premiereAt" LIMIT 5) t),
  'fundraising', (SELECT coalesce(json_agg(t), '[]') FROM (
    SELECT slug, title, "fundraisingManualPercent", "fundraisingGoalMinor", "fundraisingGoalCurrency" FROM "Video"
    WHERE status = 'PUBLISHED' AND ("fundraisingManualPercent" IS NOT NULL OR "fundraisingGoalMinor" IS NOT NULL) LIMIT 5) t),
  'publishedCount', (SELECT count(*) FROM "Video" WHERE status = 'PUBLISHED'));
`;

function collectDb() {
  // psql bez ON_ERROR_STOP: błąd jednego zapytania trafia na stderr, reszta wykonuje się dalej.
  const proc = spawnSync('docker', [
    'exec', '-i', '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=5000',
    APP_DB, 'sh', '-c', 'exec psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v since="$1" -P pager=off', 'psql', SINCE,
  ], { input: SQL, timeout: 30000, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (proc.error) throw proc.error;
  const stdout = proc.stdout ?? '';
  const stderr = proc.stderr ?? '';
  const data = {};
  for (const line of stdout.split('\n')) {
    const m = line.match(/^@@(\w+) (.*)$/);
    if (!m) continue;
    try { data[m[1]] = JSON.parse(m[2]); } catch { data[m[1]] = { error: 'nieczytelny JSON' }; }
  }
  const errors = stderr.split('\n').filter((l) => /ERROR|FATAL/.test(l)).map((l) => cut(l, 200));
  return { ...data, errors };
}

// ---------------------------------------------------------------- PP Support (GET na lokalnym API)

async function collectSupport() {
  const token = readFileSync(SUPPORT_TOKEN_FILE, 'utf8').trim();
  const headers = { api_access_token: token };
  const base = `${SUPPORT_API}/api/v1/accounts/1/conversations`;
  const byId = new Map();
  let openCount = null;
  for (let page = 1; page <= 4; page += 1) {
    const res = await getJson(`${base}?status=open&page=${page}`, headers);
    if (res.status !== 200) throw new Error(`HTTP ${res.status} dla listy otwartych rozmów`);
    openCount = res.body?.data?.meta?.all_count ?? openCount;
    const payload = res.body?.data?.payload ?? [];
    for (const c of payload) byId.set(c.id, c);
    if (payload.length < 25) break;
  }
  const recent = await getJson(`${base}?status=all&page=1`, headers);
  for (const c of recent.body?.data?.payload ?? []) {
    if ((c.created_at ?? 0) * 1000 >= SINCE_MS || (c.last_activity_at ?? 0) * 1000 >= SINCE_MS) byId.set(c.id, c);
  }
  const conversations = [...byId.values()].sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
  const out = [];
  let fetched = 0;
  for (const c of conversations) {
    const isNew = (c.created_at ?? 0) * 1000 >= SINCE_MS;
    const waiting = c.status === 'open' && (c.waiting_since ?? 0) > 0;
    let firstIncoming = null;
    if ((isNew || waiting) && fetched < 15) {
      fetched += 1;
      try {
        const msgs = await getJson(`${base}/${c.id}/messages`, headers);
        const list = (msgs.body?.payload ?? []).filter((m) => m.message_type === 0 && !m.private);
        firstIncoming = list.length ? cut(String(list[0].content ?? ''), 3000) : null;
      } catch { /* zostaje null */ }
    }
    const sender = c.meta?.sender ?? {};
    out.push({
      id: c.id,
      status: c.status,
      createdAt: c.created_at,
      lastActivityAt: c.last_activity_at,
      waitingSince: c.waiting_since || null,
      firstReplyAt: c.first_reply_created_at || null,
      unread: c.unread_count ?? 0,
      senderName: cut(sender.name ?? null, 120),
      senderEmail: sender.email ?? null,
      subject: cut(c.additional_attributes?.mail_subject ?? null, 300),
      lastMessageType: c.last_non_activity_message?.message_type ?? null,
      lastMessagePrivate: c.last_non_activity_message?.private ?? null,
      lastMessage: (isNew || waiting) ? cut(String(c.last_non_activity_message?.content ?? ''), 1500) : null,
      firstIncoming,
      labels: c.labels ?? [],
    });
  }
  return { openCount, conversations: out.slice(0, 40) };
}

// ---------------------------------------------------------------- Redis: aktywne blokady logowania

function collectLockouts() {
  const keys = run('docker', ['exec', REDIS, 'redis-cli', '--scan', '--pattern', 'rate-limit:ba:signin-fail:*', '--count', '1000'])
    .split('\n').filter(Boolean);
  const perEmail = keys.filter((k) => k.split(':').length === 4);
  const perIp = keys.filter((k) => k.split(':').length > 4);
  const read = (list) => (list.length ? run('docker', ['exec', REDIS, 'redis-cli', 'MGET', ...list.slice(0, 500)]).split('\n').filter(Boolean).map(Number) : []);
  return { perEmailCounts: read(perEmail), perIpCounts: read(perIp) };
}

// ---------------------------------------------------------------- main

const collectors = {
  host: collectHost,
  docker: collectDocker,
  timers: collectTimers,
  journal: collectJournal,
  logs: collectLogs,
  backups: collectBackups,
  healthLogs: collectHealthLogs,
  httpHealth: collectHttpHealth,
  db: collectDb,
  support: collectSupport,
  lockouts: collectLockouts,
};

const result = { since: SINCE, generatedAt: new Date().toISOString(), collectors: {} };
for (const [name, fn] of Object.entries(collectors)) {
  const started = Date.now();
  try {
    result.collectors[name] = { ok: true, ms: Date.now() - started, data: await fn() };
    result.collectors[name].ms = Date.now() - started;
  } catch (error) {
    result.collectors[name] = { ok: false, ms: Date.now() - started, error: cut(String(error?.message ?? error), 300) };
  }
}
process.stdout.write(JSON.stringify(result));
