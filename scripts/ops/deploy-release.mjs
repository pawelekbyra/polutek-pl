#!/usr/bin/env node
// Verify an immutable release before deploy scripts can migrate or activate it.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, chmodSync, cpSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const kinds = ['app', 'migrator', 'worker', 'collector', 'admin'];
const fail = message => { throw new Error(message); };
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (result.status !== 0) fail(`${command} failed${result.stderr ? `: ${result.stderr.trim().slice(0, 500)}` : ''}`);
  return result.stdout;
}
function main(argv) {
  if (!/^v22\./.test(process.version) || process.platform === 'win32') fail('Release deploy verification requires Node 22 on POSIX');
  const opts = Object.create(null);
  for (const arg of argv) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(arg);
    if (!match || Object.hasOwn(opts, match[1])) fail('Invalid or repeated deploy release option');
    opts[match[1]] = match[2];
  }
  const allowed = ['release-dir', 'revision', 'proof-sha256', 'scope', 'tag'];
  if (Object.keys(opts).some(key => !allowed.includes(key)) || !/^[a-f0-9]{40}$/.test(opts.revision ?? '')
      || !/^[a-f0-9]{64}$/.test(opts['proof-sha256'] ?? '') || !/^(app|admin)$/.test(opts.scope ?? '')
      || !/^[A-Za-z0-9._-]{1,128}$/.test(opts.tag ?? '') || !opts['release-dir']) fail('Missing or invalid release verification inputs');
  const releaseDir = path.resolve(opts['release-dir']);
  const source = path.join(releaseDir, 'source');
  const proofFile = path.join(releaseDir, 'proof.json');
  const inputsFile = path.join(releaseDir, 'inputs.json');
  if (![source, proofFile, inputsFile].every(existsSync)) fail('Release bundle must contain source/, proof.json and inputs.json');
  const proof = JSON.parse(run(process.execPath, ['-e', 'process.stdout.write(require(process.argv[1]).images ? JSON.stringify(require(process.argv[1]).images) : "")', proofFile]));
  if (Object.keys(proof).sort().join(',') !== [...kinds].sort().join(',')) fail('Release proof must contain all five image kinds');
  const refs = [];
  for (const kind of kinds) {
    const ref = proof[kind]?.registry_ref;
    const suffix = kind === 'admin' ? 'admin' : kind;
    if (typeof ref !== 'string' || !new RegExp(`^ghcr\\.io/pawelekbyra/polutek-${suffix}@sha256:[a-f0-9]{64}$`).test(ref)) {
      fail(`Release image reference is not an approved digest: ${kind}`);
    }
    refs.push([kind, ref]);
  }
  // Pulling by digest only downloads images; verification still precedes tagging, DB migration and activation.
  for (const [, ref] of refs) run('docker', ['pull', ref]);
  const verifier = path.join(source, 'scripts/ops/release-proof.mjs');
  const result = run(process.execPath, [verifier, 'verify', `--proof=${proofFile}`,
    `--proof-sha256=${opts['proof-sha256']}`, `--revision=${opts.revision}`, `--source=${source}`,
    `--inputs=${inputsFile}`, `--scope=${opts.scope}`]);
  const verified = JSON.parse(result);
  if (verified.verified !== true || verified.revision !== opts.revision) fail('Release verifier returned an invalid result');
  const selected = opts.scope === 'admin' ? ['admin'] : kinds.filter(kind => kind !== 'admin');
  const stateRoot = path.resolve('.release-state');
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const rootStat = lstatSync(stateRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('Release state root must be a real directory');
  chmodSync(stateRoot, 0o700);
  const stateDir = path.join(stateRoot, opts.revision);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const stateStat = lstatSync(stateDir);
  if (!stateStat.isDirectory() || stateStat.isSymbolicLink()) fail('Release state path must be a real directory');
  chmodSync(stateDir, 0o700);
  const stateSource = path.join(stateDir, 'source');
  if (existsSync(stateSource)) {
    const sourceStat = lstatSync(stateSource);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) fail('Stored release source must be a real directory');
    const hashPath = path.join(stateDir, 'proof.sha256');
    const hashStat = lstatSync(hashPath);
    if (!hashStat.isFile() || hashStat.isSymbolicLink()) fail('Stored release hash must be a regular file');
    const savedHash = run(process.execPath, ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1], "utf8").trim())', hashPath]);
    if (savedHash !== opts['proof-sha256']) fail('Stored release state has a different proof hash');
  } else {
    cpSync(source, stateSource, { recursive: true });
    cpSync(proofFile, path.join(stateDir, 'proof.json'));
    cpSync(inputsFile, path.join(stateDir, 'inputs.json'));
    writeFileSync(path.join(stateDir, 'proof.sha256'), `${opts['proof-sha256']}\n`, { flag: 'wx', mode: 0o600 });
  }
  for (const kind of selected) {
    const id = verified.images?.[kind];
    if (!/^sha256:[a-f0-9]{64}$/.test(id ?? '')) fail(`Verifier did not return image ID: ${kind}`);
    run('docker', ['tag', id, `polutek-${kind}:${opts.tag}`]);
    process.stdout.write(`${kind}=${id}\n`);
  }
}
try { main(process.argv.slice(2)); }
catch (error) { process.stderr.write(`${error instanceof Error ? error.message : 'Release verification failed'}\n`); process.exitCode = 1; }
