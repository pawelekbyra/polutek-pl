/**
 * pp-watchdog: external watchdog of serwerek (Cloudflare Workers Free, cron trigger every 5 min).
 * A monitor on the server dies with the server; this one runs on Cloudflare's edge.
 *
 * Every 5 minutes (scheduled):
 *   - www:      GET https://www.pawelperfect.com/api/health  -> 200
 *   - video:    GET https://video.pawelperfect.com/           -> 404 from the HLS Worker (Worker alive, R2 path served)
 *   - support:  GET https://support.pawelperfect.com/         -> 302 to Cloudflare Access
 *   - heartbeat: health.sh on the server POSTs /ping every 5 min; no ping for 15 min = the server is gone
 *                (dead man's switch); a WARN reported for 30 min is escalated here too (second channel).
 * A check alerts after 2 failed runs in a row (no e-mail for a blip), again every 6 h while failing, and once
 * when it recovers. E-mail through the Cloudflare Email Workers `send_email` binding (ALERT_EMAIL), free, no provider
 * account: it can only deliver to the verified Email Routing destination address of the binding (the owner's mailbox),
 * from an address on pawelperfect.com. At most MAX_ALERTS_PER_DAY a day. (A Worker cannot use SMTP, so not SES.)
 * State: D1 (binding DB). Free-plan budget: 288 cron runs + 288 pings a day.
 *
 * HTTP (all need "Authorization: Bearer <PING_TOKEN>"):
 *   POST /ping        body "OK" or "WARN <issues>"  (health.sh)
 *   POST /run         run the checks now, returns the states (testing)
 *   POST /test-alert  send one test e-mail
 *   GET  /status      current states as JSON
 * Deploy: node workers/pp-watchdog/deploy.mjs (docs/operations/SERWEREK.md, section 25).
 */

const CHECKS = [
  { name: 'www', url: 'https://www.pawelperfect.com/api/health', expect: (r) => r.status === 200 },
  { name: 'video', url: 'https://video.pawelperfect.com/', expect: (r) => r.status === 404 },
  {
    name: 'support',
    url: 'https://support.pawelperfect.com/',
    expect: (r) => r.status === 302 && (r.headers.get('location') || '').includes('cloudflareaccess.com'),
  },
];
const FAILS_BEFORE_ALERT = 2;
const REALERT_MS = 6 * 60 * 60 * 1000;
const PING_STALE_MS = 15 * 60 * 1000;
const WARN_ESCALATE_MS = 30 * 60 * 1000;
const MAX_ALERTS_PER_DAY = 20;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS check_state (name TEXT PRIMARY KEY, ok INTEGER NOT NULL, fails INTEGER NOT NULL,
     since INTEGER NOT NULL, last_alert INTEGER, detail TEXT, checked_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ping (source TEXT PRIMARY KEY, at INTEGER NOT NULL, status TEXT NOT NULL,
     warn_since INTEGER)`,
  `CREATE TABLE IF NOT EXISTS alert_day (day TEXT PRIMARY KEY, sent INTEGER NOT NULL)`,
];

async function ensureSchema(db) {
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
}

function authorized(request, env) {
  const header = request.headers.get('authorization') || '';
  return env.PING_TOKEN && header === `Bearer ${env.PING_TOKEN}`;
}

async function probe(check) {
  try {
    const response = await fetch(check.url, {
      redirect: 'manual',
      headers: { 'user-agent': 'pp-watchdog/1 (+https://www.pawelperfect.com)' },
      signal: AbortSignal.timeout(10_000),
      cf: { cacheTtl: 0 },
    });
    return { ok: check.expect(response), detail: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, detail: `error ${error && error.name ? error.name : 'fetch'}` };
  }
}

/** Results of all checks, including the heartbeat ones derived from the last ping. */
async function evaluate(env, now) {
  const results = await Promise.all(CHECKS.map(async (check) => ({ name: check.name, ...(await probe(check)) })));
  const ping = await env.DB.prepare('SELECT at, status, warn_since FROM ping WHERE source = ?').bind('serwerek').first();
  if (!ping) {
    results.push({ name: 'heartbeat', ok: false, detail: 'no ping received yet' });
  } else {
    const age = now - ping.at;
    results.push({ name: 'heartbeat', ok: age <= PING_STALE_MS, detail: `last ping ${Math.round(age / 60000)} min ago` });
    const warnFor = ping.warn_since ? now - ping.warn_since : 0;
    results.push({
      name: 'server-warn',
      ok: !(ping.status.startsWith('WARN') && warnFor >= WARN_ESCALATE_MS),
      detail: ping.status.slice(0, 300),
    });
  }
  return results;
}

/** "Name <addr>" or "addr" -> bare address for the envelope. */
function fromAddress(from) {
  const match = /<([^>]+)>/.exec(from || '');
  return (match ? match[1] : from || '').trim();
}

/** Minimal RFC 5322 message: ASCII subject, UTF-8 body as base64. Exported for tests. */
export function buildMime(env, subject, text, now) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const body = btoa(binary).replace(/(.{76})/g, '$1\r\n');
  const safeSubject = String(subject).replace(/[^\x20-\x7e]/g, '?').slice(0, 200);
  const domain = fromAddress(env.ALERT_FROM).split('@')[1] || 'pawelperfect.com';
  return [
    `From: ${env.ALERT_FROM}`,
    `To: ${env.ALERT_TO}`,
    `Subject: ${safeSubject}`,
    `Date: ${new Date(now).toUTCString()}`,
    `Message-ID: <${now}.${Math.random().toString(36).slice(2)}@${domain}>`,
    'Auto-Submitted: auto-generated',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
    '',
  ].join('\r\n');
}

async function sendMail(env, subject, text, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const row = await env.DB.prepare('SELECT sent FROM alert_day WHERE day = ?').bind(day).first();
  if ((row ? row.sent : 0) >= MAX_ALERTS_PER_DAY) return false;
  try {
    const { EmailMessage } = await import('cloudflare:email');
    await env.ALERT_EMAIL.send(new EmailMessage(fromAddress(env.ALERT_FROM), env.ALERT_TO, buildMime(env, subject, text, now)));
  } catch {
    return false;
  }
  await env.DB.prepare('INSERT INTO alert_day (day, sent) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET sent = sent + 1').bind(day).run();
  await env.DB.prepare('DELETE FROM alert_day WHERE day < ?').bind(new Date(now - 7 * 86400000).toISOString().slice(0, 10)).run();
  return true;
}

/** Applies one result to the stored state and decides about an e-mail. Exported for tests. */
export function nextState(previous, result, now) {
  const state = previous
    ? { ...previous }
    : { name: result.name, ok: 1, fails: 0, since: now, last_alert: null, detail: null, checked_at: now };
  let mail = null;
  if (result.ok) {
    const wasAlerting = !state.ok && state.fails >= FAILS_BEFORE_ALERT && state.last_alert;
    if (!state.ok) state.since = now;
    state.ok = 1;
    state.fails = 0;
    if (wasAlerting) {
      mail = { subject: `[pp-watchdog] OK again: ${result.name}`, text: `${result.name} is OK again (${result.detail}).` };
      state.last_alert = null;
    }
  } else {
    if (state.ok) state.since = now;
    state.ok = 0;
    state.fails += 1;
    const due = state.fails >= FAILS_BEFORE_ALERT && (!state.last_alert || now - state.last_alert >= REALERT_MS);
    if (due) {
      mail = {
        subject: `[pp-watchdog] DOWN: ${result.name}`,
        text: `${result.name} failing since ${new Date(state.since).toISOString()} (${state.fails} checks in a row): ${result.detail}.\nNext reminder in 6 h if it stays down.`,
      };
      state.last_alert = now;
    }
  }
  state.detail = result.detail;
  state.checked_at = now;
  return { state, mail };
}

async function runChecks(env, now = Date.now()) {
  await ensureSchema(env.DB);
  const results = await evaluate(env, now);
  const states = [];
  for (const result of results) {
    const previous = await env.DB.prepare('SELECT * FROM check_state WHERE name = ?').bind(result.name).first();
    const { state, mail } = nextState(previous, result, now);
    if (mail && !(await sendMail(env, mail.subject, mail.text, now)) && state.last_alert === now) {
      state.last_alert = previous ? previous.last_alert : null; // not sent: try again next run
    }
    await env.DB.prepare(
      `INSERT INTO check_state (name, ok, fails, since, last_alert, detail, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET ok = excluded.ok, fails = excluded.fails, since = excluded.since,
         last_alert = excluded.last_alert, detail = excluded.detail, checked_at = excluded.checked_at`,
    ).bind(state.name, state.ok, state.fails, state.since, state.last_alert, state.detail, state.checked_at).run();
    states.push(state);
  }
  return states;
}

const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runChecks(env));
  },

  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!authorized(request, env)) return new Response('Not found', { status: 404 });
    const now = Date.now();
    if (request.method === 'POST' && pathname === '/ping') {
      await ensureSchema(env.DB);
      const status = ((await request.text()) || 'OK').trim().slice(0, 500) || 'OK';
      await env.DB.prepare(
        `INSERT INTO ping (source, at, status, warn_since) VALUES ('serwerek', ?1, ?2, CASE WHEN ?2 LIKE 'WARN%' THEN ?1 END)
         ON CONFLICT(source) DO UPDATE SET at = ?1, status = ?2,
           warn_since = CASE WHEN ?2 LIKE 'WARN%' THEN coalesce(ping.warn_since, ?1) END`,
      ).bind(now, status).run();
      return new Response(null, { status: 204 });
    }
    if (request.method === 'POST' && pathname === '/run') return json(await runChecks(env, now));
    if (request.method === 'POST' && pathname === '/test-alert') {
      await ensureSchema(env.DB);
      const sent = await sendMail(env, '[pp-watchdog] test alert', `Test e-mail from pp-watchdog at ${new Date(now).toISOString()}. No action needed.`, now);
      return json({ sent }, sent ? 200 : 502);
    }
    if (request.method === 'GET' && pathname === '/status') {
      await ensureSchema(env.DB);
      const { results } = await env.DB.prepare('SELECT * FROM check_state ORDER BY name').all();
      const ping = await env.DB.prepare('SELECT * FROM ping').all();
      return json({ checks: results, ping: ping.results });
    }
    return new Response('Not found', { status: 404 });
  },
};
