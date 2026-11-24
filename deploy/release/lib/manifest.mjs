#!/usr/bin/env node
// Release manifest: what was built, from what, where, and the exact image IDs that must be present on the server.
// No dependencies (Node 22). Used by release-build.sh (create) and release-deploy.sh (verify / env).
//
//   create --facts DIR --out FILE     build manifest.json (+ FILE.sha256) from the facts collected by release-build.sh;
//                                     fails if an image ID or revision label differs between the builder and this server
//   verify --manifest FILE            sidecar sha256 matches, every image exists locally with the recorded ID and labels
//   env    --manifest FILE            print APP_IMAGE=... lines (validated refs) for release-deploy.sh
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA = 'polutek-release-manifest/1';
export const KINDS = Object.freeze({
  app: { repo: 'polutek-app', target: 'runner', envVar: 'APP_IMAGE' },
  migrator: { repo: 'polutek-migrator', target: 'migrator', envVar: 'MIGRATOR_IMAGE' },
  worker: { repo: 'polutek-worker', target: 'worker', envVar: 'ENCODER_IMAGE' },
  collector: { repo: 'polutek-collector', target: 'collector', envVar: 'COLLECTOR_IMAGE' },
});
export const PROBE_KINDS = Object.freeze({ probe: { repo: 'release-probe', target: '-', envVar: 'PROBE_IMAGE' } });
export const REVISION_LABEL = 'org.opencontainers.image.revision';
const REF_RE = /^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9._-]+$/;
const ID_RE = /^sha256:[a-f0-9]{64}$/;
const SHA_RE = /^[a-f0-9]{40}$/;

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Canonical bytes of a manifest (stable key order not needed: we hash the exact file we wrote). */
export function serialize(manifest) { return `${JSON.stringify(manifest, null, 2)}\n`; }

/** Compare what the builder reported with what `docker image inspect` says on this server, per image ref. */
export function compareImages({ refs, builder, local, sha }) {
  const byRef = (list) => {
    const m = new Map();
    for (const img of list) for (const t of img.RepoTags || []) m.set(t, img);
    return m;
  };
  const b = byRef(builder);
  const l = byRef(local);
  const images = {};
  const errors = [];
  for (const [kind, ref] of Object.entries(refs)) {
    const bi = b.get(ref);
    const li = l.get(ref);
    if (!bi) { errors.push(`${kind}: ${ref} missing on the builder`); continue; }
    if (!li) { errors.push(`${kind}: ${ref} missing on this server after load`); continue; }
    if (!ID_RE.test(bi.Id)) errors.push(`${kind}: invalid builder image id`);
    if (bi.Id !== li.Id) errors.push(`${kind}: image id differs (builder ${bi.Id}, server ${li.Id})`);
    const rev = li.Config?.Labels?.[REVISION_LABEL];
    if (rev !== sha) errors.push(`${kind}: revision label ${rev || '(none)'} != ${sha}`);
    images[kind] = { ref, id: li.Id, size: li.Size ?? null, created: li.Created ?? null,
      labels: li.Config?.Labels || {}, rootfs_layers: (li.RootFS?.Layers || []).length };
  }
  return { images, errors };
}

export function validateManifest(m) {
  const errors = [];
  if (m?.schema !== SCHEMA) errors.push('unknown manifest schema');
  if (!SHA_RE.test(m?.revision || '')) errors.push('revision must be a full 40-char git sha');
  if (!/^[A-Za-z0-9._-]+$/.test(m?.tag || '')) errors.push('bad tag');
  const kinds = m?.mode === 'probe' ? PROBE_KINDS : KINDS;
  for (const kind of Object.keys(kinds)) {
    const img = m?.images?.[kind];
    if (!img) { errors.push(`image ${kind} missing`); continue; }
    if (!REF_RE.test(img.ref || '')) errors.push(`image ${kind}: bad ref`);
    if (!ID_RE.test(img.id || '')) errors.push(`image ${kind}: bad id`);
  }
  return errors;
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function dockerInspect(refs) {
  try {
    return JSON.parse(execFileSync('docker', ['image', 'inspect', ...refs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    // inspect exits 1 when any ref is missing but still prints the ones it found
    const out = e.stdout ? String(e.stdout) : '';
    return out.trim().startsWith('[') ? JSON.parse(out) : [];
  }
}

function loadVerified(file) {
  const raw = readFileSync(file);
  const side = `${file}.sha256`;
  if (!existsSync(side)) throw new Error(`missing ${path.basename(side)}`);
  const expected = readFileSync(side, 'utf8').trim().split(/\s+/)[0];
  if (expected !== sha256(raw)) throw new Error('manifest checksum mismatch (file changed after the build)');
  const m = JSON.parse(raw.toString('utf8'));
  const errors = validateManifest(m);
  if (errors.length) throw new Error(errors.join('; '));
  return m;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  return o;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  if (cmd === 'create') {
    const f = (n) => path.join(a.facts, n);
    const meta = readJson(f('meta.json'));
    const refs = meta.refs;
    const { images, errors } = compareImages({ refs, builder: readJson(f('inspect-builder.json'), []),
      local: readJson(f('inspect-server.json'), []), sha: meta.revision });
    if (errors.length) throw new Error(`images do not match:\n  ${errors.join('\n  ')}`);
    const manifest = {
      schema: SCHEMA,
      tag: meta.tag,
      revision: meta.revision,
      mode: meta.mode,
      created: new Date().toISOString(),
      source: readJson(f('source.json'), null),
      build_args: readJson(f('build-args.json'), null),
      builder: readJson(f('builder.json'), null),
      versions: readJson(f('versions.json'), null),
      gate: readJson(f('gate.json'), null),
      transfer: readJson(f('transfer.json'), null),
      timings_s: readJson(f('timings.json'), null),
      cost: readJson(f('cost.json'), null),
      images,
    };
    const errs = validateManifest(manifest);
    if (errs.length) throw new Error(errs.join('; '));
    const body = serialize(manifest);
    writeFileSync(a.out, body, { mode: 0o644, flag: 'wx' });
    writeFileSync(`${a.out}.sha256`, `${sha256(Buffer.from(body))}  ${path.basename(a.out)}\n`, { mode: 0o644, flag: 'wx' });
    process.stdout.write(`${sha256(Buffer.from(body))}\n`);
    return;
  }
  if (cmd === 'verify') {
    const m = loadVerified(a.manifest);
    const refs = Object.fromEntries(Object.entries(m.images).map(([k, v]) => [k, v.ref]));
    const local = dockerInspect(Object.values(refs));
    const errors = [];
    for (const [kind, img] of Object.entries(m.images)) {
      const li = local.find((x) => (x.RepoTags || []).includes(img.ref));
      if (!li) { errors.push(`${kind}: ${img.ref} not present locally`); continue; }
      if (li.Id !== img.id) errors.push(`${kind}: ${img.ref} has id ${li.Id}, manifest says ${img.id}`);
      if (li.Config?.Labels?.[REVISION_LABEL] !== m.revision) errors.push(`${kind}: revision label mismatch`);
    }
    if (errors.length) throw new Error(errors.join('; '));
    process.stdout.write(`${JSON.stringify({ ok: true, tag: m.tag, revision: m.revision })}\n`);
    return;
  }
  if (cmd === 'env') {
    const m = loadVerified(a.manifest);
    const kinds = m.mode === 'probe' ? PROBE_KINDS : KINDS;
    const lines = [`RELEASE_TAG=${m.tag}`, `RELEASE_REVISION=${m.revision}`];
    for (const [kind, k] of Object.entries(kinds)) lines.push(`${k.envVar}=${m.images[kind].ref}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }
  throw new Error(`unknown command '${cmd || ''}'`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { main(); } catch (e) { process.stderr.write(`[manifest] ERROR: ${e.message}\n`); process.exit(1); }
}
