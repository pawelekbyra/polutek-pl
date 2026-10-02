#!/usr/bin/env node
/**
 * Deploys the HLS edge Worker through the Cloudflare API (no wrangler needed)
 * and attaches the custom domain. Idempotent: re-running updates the script.
 *
 * Env (never printed): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, HLS_TOKEN_SECRET
 * Optional: HLS_HOSTNAME (default video.pawelperfect.com), HLS_ZONE_ID,
 *           HLS_BUCKET (default polutek-hls), HLS_ALLOWED_ORIGINS
 *
 *   node workers/hls-edge/deploy.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const secret = process.env.HLS_TOKEN_SECRET;
const hostname = process.env.HLS_HOSTNAME || 'video.pawelperfect.com';
const zoneId = process.env.HLS_ZONE_ID || '02cb23af5c0000a110f6915b00bbb8ef';
const bucket = process.env.HLS_BUCKET || 'polutek-hls';
const origins = process.env.HLS_ALLOWED_ORIGINS || 'https://www.pawelperfect.com,https://pawelperfect.com';
const name = 'polutek-hls-edge';

if (!token || !account || !secret || secret.length < 32) {
  console.error('Need CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and HLS_TOKEN_SECRET (>= 32 chars)');
  process.exit(2);
}

const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
const headers = { Authorization: `Bearer ${token}` };

async function call(method, url, body, extra = {}) {
  const res = await fetch(url, { method, headers: { ...headers, ...extra }, body });
  const json = await res.json().catch(() => ({}));
  if (!json.success) throw new Error(`${method} ${url.replace(api, '')} failed: ${JSON.stringify(json.errors)}`);
  return json.result;
}

const code = await readFile(path.join(here, 'worker.mjs'), 'utf8');
const metadata = {
  main_module: 'worker.mjs',
  compatibility_date: '2026-09-01',
  bindings: [
    { type: 'r2_bucket', name: 'HLS', bucket_name: bucket },
    { type: 'plain_text', name: 'ALLOWED_ORIGINS', text: origins },
    { type: 'secret_text', name: 'HLS_TOKEN_SECRET', text: secret },
  ],
  observability: { enabled: true },
};
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.mjs', new Blob([code], { type: 'application/javascript+module' }), 'worker.mjs');
await call('PUT', `${api}/workers/scripts/${name}`, form);
console.log(`worker ${name} uploaded`);

await call('PUT', `${api}/workers/domains`, JSON.stringify({ hostname, service: name, zone_id: zoneId, environment: 'production' }), {
  'content-type': 'application/json',
});
console.log(`domain ${hostname} attached`);
