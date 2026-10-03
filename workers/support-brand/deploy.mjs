#!/usr/bin/env node
/**
 * Wdraza warstwe marki PP Support (Cloudflare Worker przed panelem) przez API Cloudflare (bez wranglera).
 * Env (nie wypisywane): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Opcjonalnie SUPPORT_ZONE_ID (domyslnie strefa pawelperfect.com).
 *
 *   node workers/support-brand/deploy.mjs            wdroz (Worker + trasy)
 *   node workers/support-brand/deploy.mjs --disable  kill switch: Worker zostaje, ale jest czystym pass-through
 *   node workers/support-brand/deploy.mjs --off      usun trasy (panel idzie bezposrednio do origin, jak przed wdrozeniem)
 *
 * Trasy bez skryptu (wykluczenia) gwarantuja, ze Worker NIE widzi: /api (aplikacja mobilna, agent AI), /auth, /cable (websocket),
 * /rails (ingress poczty i zalaczniki), /webhooks, /vite, /packs, /assets.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const e = process.env;
const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'].filter((k) => !e[k]);
if (missing.length) {
  console.error('Missing env: ' + missing.join(', '));
  process.exit(2);
}
const mode = process.argv[2] || '';
const zone = e.SUPPORT_ZONE_ID || '02cb23af5c0000a110f6915b00bbb8ef';
const cfg = JSON.parse(await readFile(path.join(here, 'brand.config.json'), 'utf8'));
const name = 'pp-support-brand';
const headers = { Authorization: `Bearer ${e.CLOUDFLARE_API_TOKEN}` };
const acct = `https://api.cloudflare.com/client/v4/accounts/${e.CLOUDFLARE_ACCOUNT_ID}`;
const zoneApi = `https://api.cloudflare.com/client/v4/zones/${zone}/workers/routes`;

async function api(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    console.error(`${init.method || 'GET'} ${url.replace(/\/zones\/[0-9a-f]+/, '/zones/<id>')} failed: ${JSON.stringify(json.errors)}`);
    process.exit(1);
  }
  return json;
}

const host = cfg.host;
const excluded = ['api', 'auth', 'cable', 'rails', 'webhooks', 'vite', 'packs', 'assets'].map((p) => `${host}/${p}*`);
const wanted = [...excluded.map((pattern) => ({ pattern })), { pattern: `${host}/*`, script: name }];

async function routes() {
  const j = await api(zoneApi);
  return j.result.filter((r) => r.pattern.startsWith(`${host}/`));
}

if (mode === '--off') {
  for (const r of await routes()) await api(`${zoneApi}/${r.id}`, { method: 'DELETE' });
  console.log('trasy usuniete: panel idzie bezposrednio do origin');
  process.exit(0);
}

// --- zasoby ---
const A = path.join(here, 'assets');
const file = (p) => readFile(path.join(here, p));
const assets = {};
const text = async (url, p, type) => { assets[url] = { type, text: (await file(p)).toString('utf8') }; };
const bin = async (url, p, type) => { assets[url] = { type, b64: (await file(p)).toString('base64') }; };
await text('/pp-support/brand.css', 'brand.css', 'text/css; charset=utf-8');
await text('/pp-support/brand.js', 'brand.js', 'application/javascript; charset=utf-8');
await text('/pp-support/logo.svg', 'assets/logo.svg', 'image/svg+xml');
await text('/pp-support/logo-dark.svg', 'assets/logo-dark.svg', 'image/svg+xml');
await text('/pp-support/logo-thumbnail.svg', 'assets/logo-thumbnail.svg', 'image/svg+xml');
for (const n of [32, 96, 180, 192, 512]) await bin(`/pp-support/icon-${n}.png`, `assets/icon-${n}.png`, 'image/png');
for (const f of ['Geist-Regular', 'Geist-Medium', 'Geist-SemiBold']) await bin(`/pp-support/fonts/${f}.woff2`, `assets/fonts/${f}.woff2`, 'font/woff2');
assets['/pp-support/manifest.webmanifest'] = {
  type: 'application/manifest+json',
  text: JSON.stringify({
    name: cfg.name, short_name: cfg.shortName, start_url: '/app/', scope: '/', display: 'standalone',
    background_color: '#f0f3f8', theme_color: cfg.accent,
    icons: [
      { src: '/pp-support/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pp-support/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }),
};
const hash = createHash('sha256');
for (const k of Object.keys(assets).sort()) hash.update(k).update(assets[k].text ?? assets[k].b64);
hash.update(JSON.stringify(cfg));
const version = hash.digest('hex').slice(0, 10);

const code = (await readFile(path.join(here, 'worker.mjs'), 'utf8')).replace('__DATA__', () => JSON.stringify({ brand: cfg, version, assets }));
const metadata = {
  main_module: 'worker.mjs',
  compatibility_date: '2026-09-01',
  bindings: [{ type: 'plain_text', name: 'BRAND_ENABLED', text: mode === '--disable' ? '0' : '1' }],
  observability: { enabled: true },
};
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.mjs', new Blob([code], { type: 'application/javascript+module' }), 'worker.mjs');
await api(`${acct}/workers/scripts/${name}`, { method: 'PUT', body: form });
console.log(`worker ${name} wgrany (wersja ${version}, BRAND_ENABLED=${mode === '--disable' ? 0 : 1}, ${(code.length / 1024).toFixed(0)} KB)`);

// --- trasy ---
const existing = await routes();
for (const w of wanted) {
  const have = existing.find((r) => r.pattern === w.pattern);
  if (have && (have.script || undefined) === w.script) continue;
  if (have) await api(`${zoneApi}/${have.id}`, { method: 'DELETE' });
  await api(zoneApi, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(w) });
}
console.log(`trasy ok (${wanted.length}): ${host}/* -> ${name}; wykluczenia bez skryptu: ${excluded.map((p) => p.slice(host.length)).join(' ')}`);
