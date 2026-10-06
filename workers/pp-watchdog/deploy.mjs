#!/usr/bin/env node
/**
 * Deploys pp-watchdog through the Cloudflare API (no wrangler). Idempotent.
 * Creates the D1 database "pp-watchdog" if missing, uploads the Worker with its bindings, sets the cron trigger
 * (every 5 min) and turns on its workers.dev address (needed for /ping from the server).
 * Env (never printed): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, WATCHDOG_PING_TOKEN (same as WATCHDOG_PING_TOKEN in alert.env).
 * Optional: WATCHDOG_ALERT_TO (default pawel.perfect@gmail.com; MUST be a verified destination address in Cloudflare Email
 * Routing of the zone), WATCHDOG_ALERT_FROM (an address on pawelperfect.com, default pp-watchdog@pawelperfect.com).
 * Alert mail uses the free Email Workers `send_email` binding restricted to that destination: no e-mail provider key.
 *
 *   node workers/pp-watchdog/deploy.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const e = process.env;
const need = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'WATCHDOG_PING_TOKEN'];
const missing = need.filter((k) => !e[k]);
if (missing.length) {
  console.error('Missing env: ' + missing.join(', '));
  process.exit(2);
}
const name = 'pp-watchdog';
const api = `https://api.cloudflare.com/client/v4/accounts/${e.CLOUDFLARE_ACCOUNT_ID}`;
const headers = { Authorization: `Bearer ${e.CLOUDFLARE_API_TOKEN}` };

async function call(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, { method, headers: { ...headers, ...extraHeaders }, body });
  const json = await res.json().catch(() => ({}));
  if (!json.success) throw new Error(`${method} ${url.replace(api, '')} failed: ${JSON.stringify(json.errors)}`);
  return json.result;
}

// 1. D1 database.
const databases = await call('GET', `${api}/d1/database?name=${name}`);
let database = databases.find((d) => d.name === name);
if (!database) {
  database = await call('POST', `${api}/d1/database`, JSON.stringify({ name }), { 'Content-Type': 'application/json' });
  console.log(`D1 ${name} created`);
}
const databaseId = database.uuid || database.id;

// 2. Script with bindings.
const code = await readFile(path.join(here, 'worker.mjs'), 'utf8');
const alertTo = e.WATCHDOG_ALERT_TO || 'pawel.perfect@gmail.com';
const metadata = {
  main_module: 'worker.mjs',
  compatibility_date: '2026-09-01',
  bindings: [
    { type: 'd1', name: 'DB', id: databaseId },
    { type: 'plain_text', name: 'ALERT_TO', text: alertTo },
    { type: 'plain_text', name: 'ALERT_FROM', text: e.WATCHDOG_ALERT_FROM || 'pp-watchdog <pp-watchdog@pawelperfect.com>' },
    { type: 'send_email', name: 'ALERT_EMAIL', destination_address: alertTo },
    { type: 'secret_text', name: 'PING_TOKEN', text: e.WATCHDOG_PING_TOKEN },
  ],
  observability: { enabled: true },
};
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.mjs', new Blob([code], { type: 'application/javascript+module' }), 'worker.mjs');
await call('PUT', `${api}/workers/scripts/${name}`, form);
console.log(`worker ${name} uploaded`);

// 3. Cron trigger and workers.dev address.
await call('PUT', `${api}/workers/scripts/${name}/schedules`, JSON.stringify([{ cron: '*/5 * * * *' }]), { 'Content-Type': 'application/json' });
await call('POST', `${api}/workers/scripts/${name}/subdomain`, JSON.stringify({ enabled: true, previews_enabled: false }), { 'Content-Type': 'application/json' });
const sub = await call('GET', `${api}/workers/subdomain`);
console.log(`cron */5 set; ping URL: https://${name}.${sub.subdomain}.workers.dev/ping`);
