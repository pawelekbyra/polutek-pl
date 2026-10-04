#!/usr/bin/env node
// Dzienna odprawa: "co słychać?" w jednym raporcie (Markdown albo JSON). TYLKO ODCZYT.
//
//   node scripts/ops/briefing.mjs                  # od ostatniej odprawy (domyślnie 24 h)
//   node scripts/ops/briefing.mjs --since=48h      # albo 7d, 90m, 2026-10-03 (północ w Warszawie), pełny ISO
//   node scripts/ops/briefing.mjs --section=poczta # tylko jedna sekcja (decyzje, poczta, komentarze, wplaty,
//                                                  #   uzytkownicy, system, koszty, premiera)
//   node scripts/ops/briefing.mjs --json           # surowy raport (już oczyszczony) zamiast Markdown
//   node scripts/ops/briefing.mjs --no-ssh         # bez serwera: tylko część z komputera (Stripe, Cloudflare,
//                                                  #   Hetzner, certyfikaty, domeny, strona publiczna)
//   node scripts/ops/briefing.mjs --no-save        # nie zapisuj stanu "ostatniej odprawy"
//
// Serwer: jedno połączenie `ssh serwerek`, na którym node wykonuje scripts/ops/briefing-remote.mjs (stdin).
// Sekrety: %USERPROFILE%\.ai-secrets\secrets.env (czytane do pamięci, nigdy wypisywane; wynik przechodzi
// przez redactSecrets). Stan: %USERPROFILE%\.ai-secrets\briefing-state.json (poza repo).
// Wywołania zewnętrzne to wyłącznie GET (Stripe, RDAP, Hetzner, strona) oraz jedno zapytanie GraphQL
// (odczyt analityki Cloudflare). Opis: docs/operations/DAILY-BRIEFING.md.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildReport, parseArgs, redactSecrets, renderMarkdown, resolveSince, snapshotFrom } from './briefing-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SECRETS_DIR = process.env.AI_SECRETS_DIR ?? path.join(os.homedir(), '.ai-secrets');
const STATE_FILE = process.env.BRIEFING_STATE_FILE
  ?? (existsSync(SECRETS_DIR) ? path.join(SECRETS_DIR, 'briefing-state.json') : path.join(os.homedir(), '.claude', 'briefing-state.json'));
const HTTP_TIMEOUT_MS = 10000;
const SSH_TIMEOUT_MS = 150000;

const HELP = `Dzienna odprawa (tylko odczyt).
  --since=24h|48h|7d|90m|2026-10-03|<ISO>  okno czasu (domyślnie od ostatniej odprawy, inaczej 24 h)
  --section=<nazwa>                        decyzje, poczta, komentarze, wplaty, uzytkownicy, system, koszty, premiera
  --json                                   raport jako JSON
  --no-ssh                                 bez serwera (tylko dane z komputera)
  --no-save                                nie zapisuj stanu ostatniej odprawy
Opis: docs/operations/DAILY-BRIEFING.md`;

// ------------------------------------------------------------------ pliki lokalne

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value) out[line.slice(0, i).trim()] = value;
  }
  return out;
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

// ------------------------------------------------------------------ HTTP (tylko GET + jedno zapytanie GraphQL)

async function httpGet(url, headers = {}) {
  const started = Date.now();
  const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: res.status, body, ms: Date.now() - started };
}

async function step(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).slice(0, 300) };
  }
}

function certValidTo(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: HTTP_TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) reject(new Error('brak certyfikatu'));
      else resolve(new Date(cert.valid_to).toISOString());
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', (error) => reject(new Error(error.code ?? error.message)));
  });
}

async function collectLocal(cfg, secrets, since) {
  const sinceEpoch = Math.floor(since.getTime() / 1000);
  const local = {};

  local.publicHealth = await step(async () => {
    const r = await httpGet(cfg.publicHealthUrl);
    return { url: cfg.publicHealthUrl, status: r.status, ok: r.body?.ok === true, ms: r.ms };
  });

  local.tls = await step(async () => Promise.all((cfg.tlsHosts ?? []).map(async (host) => {
    try { return { host, validTo: await certValidTo(host) }; } catch (error) { return { host, error: error.message }; }
  })));

  local.domains = await step(async () => Promise.all((cfg.domains ?? []).map(async (domain) => {
    try {
      const r = await httpGet(domain.rdap, { accept: 'application/rdap+json' });
      const exp = (r.body?.events ?? []).find((e) => e.eventAction === 'expiration')?.eventDate;
      if (!exp) throw new Error(`RDAP HTTP ${r.status} bez daty wygaśnięcia`);
      return { name: domain.name, expiresAt: exp, note: domain.note ?? null };
    } catch (error) {
      return { name: domain.name, expiresAt: domain.fallbackExpiresAt ?? null, note: domain.note ?? null, error: `RDAP: ${error.message}` };
    }
  })));

  local.stripe = await step(async () => {
    if (!secrets.STRIPE_SECRET_KEY) throw new Error('brak STRIPE_SECRET_KEY w secrets.env');
    const headers = { Authorization: `Basic ${Buffer.from(`${secrets.STRIPE_SECRET_KEY}:`).toString('base64')}` };
    const api = 'https://api.stripe.com/v1';
    const [disputes, refunds, events, hooks] = await Promise.all([
      httpGet(`${api}/disputes?limit=20`, headers),
      httpGet(`${api}/refunds?limit=20&created[gte]=${sinceEpoch}`, headers),
      httpGet(`${api}/events?limit=100&created[gte]=${sinceEpoch}`, headers),
      httpGet(`${api}/webhook_endpoints?limit=10`, headers),
    ]);
    for (const r of [disputes, refunds, events, hooks]) {
      if (r.status !== 200) throw new Error(`Stripe HTTP ${r.status}: ${r.body?.error?.type ?? 'błąd'}`);
    }
    const eventList = events.body.data ?? [];
    const enabled = new Set(hooks.body.data.filter((w) => w.status === 'enabled').flatMap((w) => w.enabled_events ?? []));
    const covered = eventList.filter((e) => enabled.has('*') || enabled.has(e.type));
    const tenMinAgo = Date.now() / 1000 - 600;
    return {
      disputes: disputes.body.data.map((x) => ({
        id: x.id, amount: x.amount, currency: x.currency, status: x.status, reason: x.reason,
        created: x.created, dueBy: x.evidence_details?.due_by ?? null,
      })),
      refunds: refunds.body.data.map((x) => ({ id: x.id, amount: x.amount, currency: x.currency, status: x.status, created: x.created })),
      eventsSince: eventList.length,
      eventsHasMore: Boolean(events.body.has_more),
      webhookEventsSince: covered.length,
      // pending_webhooks: ile endpointów jeszcze nie potwierdziło odbioru (Stripe ponawia do 3 dni).
      undeliveredEvents: covered.filter((e) => (e.pending_webhooks ?? 0) > 0 && e.created < tenMinAgo).length,
      webhooks: hooks.body.data.map((w) => {
        const u = new URL(w.url);
        return { url: `${u.host}${u.pathname}`, status: w.status, events: (w.enabled_events ?? []).length };
      }),
    };
  });

  local.cloudflare = await step(async () => {
    if (!secrets.CLOUDFLARE_API_TOKEN || !secrets.CLOUDFLARE_ACCOUNT_ID) throw new Error('brak CLOUDFLARE_API_TOKEN/ACCOUNT_ID');
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Zapytanie GraphQL to odczyt analityki (POST wymagany przez API, nic nie zmienia).
    const query = `query($a: String!, $s: Time!, $e: Time!) { viewer { accounts(filter: {accountTag: $a}) {
      workersInvocationsAdaptive(limit: 100, filter: {datetime_geq: $s, datetime_leq: $e}) {
        sum { requests errors } dimensions { scriptName } } } } }`;
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { a: secrets.CLOUDFLARE_ACCOUNT_ID, s: dayStart.toISOString(), e: now.toISOString() } }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const body = await res.json();
    if (body.errors?.length) throw new Error(`GraphQL: ${String(body.errors[0].message).slice(0, 150)}`);
    const rows = body.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
    const byName = new Map();
    for (const r of rows) {
      const cur = byName.get(r.dimensions.scriptName) ?? { scriptName: r.dimensions.scriptName, requests: 0, errors: 0 };
      cur.requests += r.sum.requests;
      cur.errors += r.sum.errors;
      byName.set(cur.scriptName, cur);
    }
    const byScript = [...byName.values()].sort((a, b) => b.requests - a.requests);
    return { totalRequests: byScript.reduce((s, x) => s + x.requests, 0), byScript };
  });

  local.hetzner = await step(async () => {
    if (!secrets.HETZNER_API_TOKEN) throw new Error('brak HETZNER_API_TOKEN');
    const r = await httpGet(`https://api.hetzner.cloud/v1/servers/${cfg.hetznerServerId}`, { Authorization: `Bearer ${secrets.HETZNER_API_TOKEN}` });
    if (r.status !== 200) throw new Error(`Hetzner HTTP ${r.status}`);
    const s = r.body.server;
    const loc = s.datacenter?.location?.name;
    const price = (s.server_type?.prices ?? []).find((p) => p.location === loc)?.price_monthly?.gross;
    return {
      type: String(s.server_type?.name ?? '?').toUpperCase(),
      cores: s.server_type?.cores,
      memoryGb: s.server_type?.memory,
      diskGb: s.server_type?.disk,
      status: s.status,
      monthlyGross: price ? `${Number(price).toFixed(2)} EUR` : null,
    };
  });

  return local;
}

// ------------------------------------------------------------------ serwer (jedno połączenie ssh)

function runRemote(host, since) {
  const script = readFileSync(path.join(HERE, 'briefing-remote.mjs'), 'utf8');
  return new Promise((resolve) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'node', '--input-type=module', '-', since.toISOString()], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); }, SSH_TIMEOUT_MS);
    child.stdout.on('data', (b) => { stdout += b; });
    child.stderr.on('data', (b) => { stderr += b; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ remote: null, reason: `ssh: ${error.message}` }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.fatal) resolve({ remote: null, reason: parsed.fatal });
        else resolve({ remote: parsed, reason: null });
      } catch {
        const first = stderr.split('\n').find((l) => l.trim()) ?? '';
        resolve({ remote: null, reason: `ssh ${host} (kod ${code}): ${first.slice(0, 200) || 'brak wyniku'}` });
      }
    });
    child.stdin.end(script);
  });
}

// ------------------------------------------------------------------ main

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  const cfg = readJson(path.join(HERE, 'briefing.config.json'), {});
  const secrets = readEnvFile(path.join(SECRETS_DIR, 'secrets.env'));
  // OPS_ADMIN_USER_ID (id konta admina dla scripts/ops/actions) nie jest sekretem: nie maskujemy go w raporcie.
  const secretValues = [
    ...Object.entries(secrets).filter(([key]) => key !== 'OPS_ADMIN_USER_ID').map(([, value]) => value),
    ...Object.values(readEnvFile(path.join(SECRETS_DIR, 'pp-support.env'))),
  ];
  const state = readJson(STATE_FILE, {});
  const now = new Date();
  let window;
  try {
    window = resolveSince({ sinceArg: opts.since, state, now });
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const host = process.env.BRIEFING_SSH_HOST ?? cfg.sshHost ?? 'serwerek';
  const [remoteResult, localData] = await Promise.all([
    opts.noSsh ? Promise.resolve({ remote: null, reason: 'pominięto (--no-ssh)' }) : runRemote(host, window.since),
    collectLocal(cfg, secrets, window.since),
  ]);

  const inputs = {
    now,
    since: window.since,
    sinceSource: window.source,
    remote: remoteResult.remote,
    remoteReason: remoteResult.reason,
    local: localData,
    config: cfg,
    previousSnapshot: state.snapshot ?? null,
  };
  const report = buildReport(inputs);
  const output = opts.json
    ? JSON.stringify(opts.section ? { ...report, sections: report.sections.filter((s) => s.key === opts.section) } : report, null, 2)
    : renderMarkdown(report, { section: opts.section });
  process.stdout.write(`${redactSecrets(output, secretValues)}\n`);

  if (!opts.noSave && !opts.section && remoteResult.remote) {
    try {
      mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify({ lastRunAt: now.toISOString(), snapshot: snapshotFrom(inputs) ?? state.snapshot ?? null }, null, 2));
    } catch (error) {
      console.error(`Nie zapisano stanu odprawy (${STATE_FILE}): ${error.message}`);
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(`odprawa: ${String(error?.message ?? error).slice(0, 300)}`);
    process.exitCode = 1;
  });
}
