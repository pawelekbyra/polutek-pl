#!/usr/bin/env node
/**
 * Deploys the support mail ingest Email Worker through the Cloudflare API (no wrangler).
 * Idempotent. Env (never printed): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
 * SUPPORT_INGEST_PASSWORD (= RAILS_INBOUND_EMAIL_PASSWORD on the server),
 * SUPPORT_ACCESS_CLIENT_ID, SUPPORT_ACCESS_CLIENT_SECRET (Access service token "support-mail-ingest").
 * Optional: SUPPORT_INGEST_URL, SUPPORT_ARCHIVE_TO.
 *
 *   node workers/support-mail-ingest/deploy.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const e = process.env;
const need = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'SUPPORT_INGEST_PASSWORD', 'SUPPORT_ACCESS_CLIENT_ID', 'SUPPORT_ACCESS_CLIENT_SECRET'];
const missing = need.filter((k) => !e[k]);
if (missing.length) {
  console.error('Missing env: ' + missing.join(', '));
  process.exit(2);
}
const name = 'polutek-support-mail';
const api = `https://api.cloudflare.com/client/v4/accounts/${e.CLOUDFLARE_ACCOUNT_ID}`;

const code = await readFile(path.join(here, 'worker.mjs'), 'utf8');
const metadata = {
  main_module: 'worker.mjs',
  compatibility_date: '2026-09-01',
  bindings: [
    { type: 'plain_text', name: 'CHATWOOT_INGEST_URL', text: e.SUPPORT_INGEST_URL || 'https://support.pawelperfect.com/rails/action_mailbox/relay/inbound_emails' },
    { type: 'plain_text', name: 'ARCHIVE_TO', text: e.SUPPORT_ARCHIVE_TO || 'pawel.perfect@gmail.com' },
    { type: 'plain_text', name: 'ACCESS_CLIENT_ID', text: e.SUPPORT_ACCESS_CLIENT_ID },
    { type: 'secret_text', name: 'ACCESS_CLIENT_SECRET', text: e.SUPPORT_ACCESS_CLIENT_SECRET },
    { type: 'secret_text', name: 'CHATWOOT_INGEST_PASSWORD', text: e.SUPPORT_INGEST_PASSWORD },
  ],
  observability: { enabled: true },
};
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.mjs', new Blob([code], { type: 'application/javascript+module' }), 'worker.mjs');
const res = await fetch(`${api}/workers/scripts/${name}`, { method: 'PUT', headers: { Authorization: `Bearer ${e.CLOUDFLARE_API_TOKEN}` }, body: form });
const json = await res.json().catch(() => ({}));
if (!json.success) {
  console.error('upload failed: ' + JSON.stringify(json.errors));
  process.exit(1);
}
console.log(`worker ${name} uploaded`);
