#!/usr/bin/env node
// Minimal Hetzner Cloud API client for the release builder (no dependencies, Node 22 fetch).
// Token: env HCLOUD_TOKEN only (never an argument, never printed). Every resource it creates carries the labels
// managed-by=polutek-release, role=builder, run=<run id>, expires=<epoch>; destroy/gc touch ONLY resources with
// those labels, a name starting with "polutek-rb-" and never a server whose IPv4 is RB_PROD_IP (the production server
// lives in the same project).
//
// Commands (JSON on stdout, diagnostics on stderr):
//   pick-type   --location L --min-cores N --min-mem GB [--type NAME]   cheapest available x86 type that fits
//   locate-ip   --ip A.B.C.D                                             location of the server with that IPv4
//   create      --run R --name N --type T --location L --image I --user-data FILE --ssh-pubkey FILE
//               --allow-cidrs a/32,b/32 --ttl-min M
//   destroy     --run R                 delete server, firewall and SSH key of one run, then verify they are gone
//   gc          [--all] [--dry-run]     delete expired builder resources (all builder resources with --all)
//   inventory   [--run R]               builder resources still present (empty lists = nothing left)
//   cost        --type T --location L --seconds S
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const API = 'https://api.hetzner.cloud/v1';
export const MANAGED = 'managed-by=polutek-release';
export const NAME_PREFIX = 'polutek-rb-';

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i += 1; }
    } else out._.push(a);
  }
  return out;
}

/** Cheapest x86 server type with at least minCores/minMemGB that is orderable in `location` right now. */
export function pickServerType(serverTypes, { location, minCores, minMemGB, forced }) {
  const fits = serverTypes.filter((t) => {
    if (forced) return t.name === forced;
    if (t.architecture !== 'x86' || t.cores < minCores || t.memory < minMemGB) return false;
    if (t.deprecation) return false;
    return true;
  }).map((t) => {
    const loc = (t.locations || []).find((l) => l.name === location);
    const price = (t.prices || []).find((p) => p.location === location);
    return { t, loc, price };
  }).filter(({ loc, price }) => loc && loc.available !== false && !loc.deprecation && price);
  if (!fits.length) return null;
  fits.sort((a, b) => Number(a.price.price_hourly.gross) - Number(b.price.price_hourly.gross));
  const { t, price } = fits[0];
  return { name: t.name, cores: t.cores, memory: t.memory, disk: t.disk, cpu_type: t.cpu_type, location,
    price_hourly_gross: Number(price.price_hourly.gross), price_hourly_net: Number(price.price_hourly.net) };
}

/** Hetzner Cloud bills per started hour (capped by the monthly price); `exact` is the proportional figure. */
export function costOf({ priceHourlyGross, ipv4HourlyGross = 0, seconds }) {
  const perHour = priceHourlyGross + ipv4HourlyGross;
  const hours = Math.max(seconds, 0) / 3600;
  const billedHours = Math.max(1, Math.ceil(hours));
  return { seconds, per_hour_gross_eur: round(perHour, 5), exact_gross_eur: round(perHour * hours, 5),
    billed_hours: billedHours, billed_gross_eur: round(perHour * billedHours, 5) };
}

function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }

/** A resource may be deleted only when it is ours: managed label, builder name prefix, not the production IPv4. */
export function isOurs(resource, prodIp) {
  const labels = resource.labels || {};
  if (labels['managed-by'] !== 'polutek-release' || labels.role !== 'builder') return false;
  if (typeof resource.name !== 'string' || !resource.name.startsWith(NAME_PREFIX)) return false;
  const ip = resource.public_net?.ipv4?.ip;
  if (prodIp && ip && ip === prodIp) return false;
  return true;
}

export function isExpired(resource, nowSec) {
  const exp = Number(resource.labels?.expires);
  return Number.isFinite(exp) && exp > 0 && nowSec >= exp;
}

function token() {
  const t = process.env.HCLOUD_TOKEN;
  if (!t) throw new Error('HCLOUD_TOKEN is not set');
  return t;
}

async function api(method, path, body) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404 && method !== 'POST') return { notFound: true };
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (res.ok) return data;
    const code = data?.error?.code || res.status;
    const retryable = res.status === 429 || res.status >= 500 || code === 'locked' || code === 'conflict' || code === 'resource_in_use';
    if (retryable && attempt < 12) { await sleep(5000); continue; }
    throw new Error(`${method} ${path}: HTTP ${res.status} ${code}: ${data?.error?.message || ''}`.trim());
  }
}

async function listAll(path, key) {
  const items = [];
  for (let page = 1; page < 50; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await api('GET', `${path}${sep}per_page=50&page=${page}`);
    items.push(...(data[key] || []));
    if (!data.meta?.pagination?.next_page) break;
  }
  return items;
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function waitAction(id, timeoutMs = 300_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const { action } = await api('GET', `/actions/${id}`);
    if (action.status === 'success') return action;
    if (action.status === 'error') throw new Error(`action ${id} failed: ${action.error?.message || ''}`);
    await sleep(2000);
  }
  throw new Error(`action ${id} timed out`);
}

async function ipv4HourlyGross(location) {
  const { pricing } = await api('GET', '/pricing');
  const v4 = (pricing.primary_ips || []).find((p) => p.type === 'ipv4');
  const p = v4?.prices?.find((x) => x.location === location);
  return p ? Number(p.price_hourly.gross) : 0;
}

async function runResources(selector) {
  const sel = encodeURIComponent(selector);
  const [servers, firewalls, keys] = await Promise.all([
    listAll(`/servers?label_selector=${sel}`, 'servers'),
    listAll(`/firewalls?label_selector=${sel}`, 'firewalls'),
    listAll(`/ssh_keys?label_selector=${sel}`, 'ssh_keys'),
  ]);
  return { servers, firewalls, keys };
}

async function deleteResources({ servers, firewalls, keys }, prodIp, log) {
  const deleted = { servers: [], firewalls: [], ssh_keys: [] };
  for (const s of servers) {
    if (!isOurs(s, prodIp)) { log(`refusing to delete server ${s.id} ${s.name}: not a builder`); continue; }
    const r = await api('DELETE', `/servers/${s.id}`);
    if (r.action) await waitAction(r.action.id);
    deleted.servers.push(s.id);
    log(`deleted server ${s.id} ${s.name}`);
  }
  for (const f of firewalls) {
    if (!isOurs(f, prodIp)) { log(`refusing to delete firewall ${f.id}: not a builder`); continue; }
    if (!(await api('DELETE', `/firewalls/${f.id}`)).notFound) log(`deleted firewall ${f.id} ${f.name}`);
    deleted.firewalls.push(f.id);
  }
  for (const k of keys) {
    if (!isOurs(k, prodIp)) { log(`refusing to delete ssh key ${k.id}: not a builder`); continue; }
    if (!(await api('DELETE', `/ssh_keys/${k.id}`)).notFound) log(`deleted ssh key ${k.id} ${k.name}`);
    deleted.ssh_keys.push(k.id);
  }
  return deleted;
}

function summarize({ servers, firewalls, keys }) {
  return {
    servers: servers.map((s) => ({ id: s.id, name: s.name, status: s.status, created: s.created, labels: s.labels,
      ip: s.public_net?.ipv4?.ip || null })),
    firewalls: firewalls.map((f) => ({ id: f.id, name: f.name, labels: f.labels })),
    ssh_keys: keys.map((k) => ({ id: k.id, name: k.name, labels: k.labels })),
  };
}

const RUN_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  const prodIp = process.env.RB_PROD_IP || '';
  const log = (m) => process.stderr.write(`[hcloud] ${m}\n`);
  const print = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

  if (cmd === 'pick-type') {
    const types = await listAll('/server_types', 'server_types');
    const picked = pickServerType(types, { location: a.location, minCores: Number(a['min-cores'] || 4),
      minMemGB: Number(a['min-mem'] || 8), forced: typeof a.type === 'string' ? a.type : undefined });
    if (!picked) throw new Error(`no available server type in ${a.location} for the requirements`);
    picked.ipv4_hourly_gross = await ipv4HourlyGross(a.location);
    return print(picked);
  }
  if (cmd === 'locate-ip') {
    const servers = await listAll('/servers', 'servers');
    const s = servers.find((x) => x.public_net?.ipv4?.ip === a.ip);
    if (!s) throw new Error(`no server with IPv4 ${a.ip} in this project`);
    return print({ server_id: s.id, location: s.location?.name || s.datacenter?.location?.name });
  }
  if (cmd === 'create') {
    if (!RUN_RE.test(a.run || '')) throw new Error('bad --run');
    const ttl = Number(a['ttl-min'] || 90);
    const expires = Math.floor(Date.now() / 1000) + ttl * 60;
    const labels = { 'managed-by': 'polutek-release', role: 'builder', run: a.run, expires: String(expires),
      'ttl-min': String(ttl) };
    const cidrs = String(a['allow-cidrs'] || '').split(',').filter(Boolean);
    if (!cidrs.length) throw new Error('--allow-cidrs is required (SSH is never open to the world)');
    const name = `${NAME_PREFIX}${a.run}`;
    const fw = await api('POST', '/firewalls', { name, labels,
      rules: [{ direction: 'in', protocol: 'tcp', port: '22', source_ips: cidrs, description: 'ssh from release host' }] });
    const key = await api('POST', '/ssh_keys', { name, labels, public_key: readFileSync(a['ssh-pubkey'], 'utf8').trim() });
    const created = await api('POST', '/servers', {
      name, server_type: a.type, location: a.location, image: a.image || 'ubuntu-24.04', labels,
      ssh_keys: [key.ssh_key.id], firewalls: [{ firewall: fw.firewall.id }],
      user_data: readFileSync(a['user-data'], 'utf8'), start_after_create: true,
      public_net: { enable_ipv4: true, enable_ipv6: true },
    });
    const id = created.server.id;
    const end = Date.now() + 300_000;
    let server = created.server;
    while (server.status !== 'running' && Date.now() < end) {
      await sleep(3000);
      server = (await api('GET', `/servers/${id}`)).server;
    }
    if (server.status !== 'running') throw new Error(`server ${id} not running after 5 min (status ${server.status})`);
    return print({ server_id: id, name, ip: server.public_net.ipv4.ip, firewall_id: fw.firewall.id,
      ssh_key_id: key.ssh_key.id, created: server.created, expires, type: a.type, location: a.location });
  }
  if (cmd === 'destroy') {
    if (!RUN_RE.test(a.run || '')) throw new Error('bad --run');
    const sel = `${MANAGED},role=builder,run=${a.run}`;
    const deleted = await deleteResources(await runResources(sel), prodIp, log);
    const left = summarize(await runResources(sel));
    print({ deleted, left });
    if (left.servers.length || left.firewalls.length || left.ssh_keys.length) process.exitCode = 3;
    return undefined;
  }
  if (cmd === 'gc') {
    const now = Math.floor(Date.now() / 1000);
    const all = await runResources(`${MANAGED},role=builder`);
    // A firewall / key is removed together with an expired server, or on its own once its own expiry has passed.
    const pick = (list) => list.filter((r) => a.all || isExpired(r, now));
    const target = { servers: pick(all.servers), firewalls: pick(all.firewalls), keys: pick(all.keys) };
    if (a['dry-run']) return print({ would_delete: summarize(target) });
    const deleted = await deleteResources(target, prodIp, log);
    return print({ deleted, left: summarize(await runResources(`${MANAGED},role=builder`)) });
  }
  if (cmd === 'inventory') {
    const sel = a.run ? `${MANAGED},role=builder,run=${a.run}` : `${MANAGED},role=builder`;
    const res = summarize(await runResources(sel));
    const [volumes, fips, pips] = await Promise.all([
      listAll(`/volumes?label_selector=${encodeURIComponent(sel)}`, 'volumes'),
      listAll(`/floating_ips?label_selector=${encodeURIComponent(sel)}`, 'floating_ips'),
      listAll('/primary_ips', 'primary_ips'),
    ]);
    return print({ ...res, volumes: volumes.length, floating_ips: fips.length,
      unassigned_primary_ips: pips.filter((p) => !p.assignee_id).map((p) => p.name) });
  }
  if (cmd === 'cost') {
    const types = await listAll('/server_types', 'server_types');
    const t = types.find((x) => x.name === a.type);
    const price = t?.prices?.find((p) => p.location === a.location);
    if (!price) throw new Error(`no price for ${a.type} in ${a.location}`);
    return print({ type: a.type, location: a.location, ...costOf({ priceHourlyGross: Number(price.price_hourly.gross),
      ipv4HourlyGross: await ipv4HourlyGross(a.location), seconds: Number(a.seconds || 0) }), currency: 'EUR' });
  }
  throw new Error(`unknown command '${cmd || ''}'`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { process.stderr.write(`[hcloud] ERROR: ${e.message}\n`); process.exit(1); });
}
