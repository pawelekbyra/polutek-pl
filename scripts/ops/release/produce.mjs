import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REVISION, captureGitSource, readJson, requireValue, verifySourceArchive } from './source.mjs';
import { validateInputs, validateQuality } from './policy.mjs';
import { buildRelease } from './build.mjs';

function runCI(args, options) {
  execFileSync('nice', ['-n', '10', process.execPath, ...args], { ...options, stdio: 'inherit', timeout: 4 * 60 * 60_000 });
}

/** The producer runs checks itself; no caller-supplied report, filters, skips or shell arguments. */
export function produceRelease({ root, revision, inputs, output }, ports = {}) {
  requireValue(/^v22\./.test(process.version) && process.platform !== 'win32', 'Release production requires Node 22 on POSIX');
  requireValue(REVISION.test(revision ?? ''), 'Expected revision must be a full commit SHA');
  validateInputs(inputs);
  const checkout = realpathSync(root);
  const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  requireValue(realpathSync(git('rev-parse', '--show-toplevel').trim()) === checkout, 'Producer requires the checkout root');
  const checkCheckout = () => {
    requireValue(git('rev-parse', 'HEAD').trim() === revision, 'Producer checkout revision mismatch');
    requireValue(git('status', '--porcelain', '--untracked-files=all').trim() === '', 'Producer requires a clean checkout');
    return captureGitSource(checkout);
  };
  const before = checkCheckout();
  const destination = path.resolve(output);
  requireValue(destination !== checkout, 'Producer output must not replace the checkout');
  mkdirSync(destination, { mode: 0o700 });
  const runId = randomUUID();
  (ports.runCI ?? runCI)([path.join(checkout, 'scripts/ops/local-ci.mjs'), '--full', '--strict', '--jobs=1', `--base=${revision}`],
    { cwd: checkout, env: { ...process.env, POLUTEK_CI_RUN_ID: runId } });
  const after = checkCheckout();
  requireValue(before.fingerprint === after.fingerprint, 'Producer sources changed during checks');
  const report = readJson(path.join(checkout, '.claude/local-ci-last.json'));
  requireValue(report.runId === runId, 'CI did not produce a fresh report for this invocation');
  const quality = validateQuality(report, revision);
  requireValue(quality.source.fingerprint === before.fingerprint, 'CI checked a different source inventory');
  writeFileSync(path.join(destination, 'quality.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(path.join(destination, 'inputs.json'), JSON.stringify(inputs, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const archive = path.join(destination, 'source.tar');
  git('archive', '--format=tar', `--output=${archive}`, revision);
  const sourceRoot = path.join(destination, 'source');
  mkdirSync(sourceRoot, { mode: 0o700 });
  execFileSync('tar', ['-xf', archive, '-C', sourceRoot], { stdio: 'pipe', timeout: 60_000 });
  verifySourceArchive(sourceRoot, quality.source);
  // Recheck checkout after archiving; the builder also checks archive bytes around each build.
  requireValue(checkCheckout().fingerprint === before.fingerprint, 'Producer source inventory changed before building');
  return (ports.build ?? buildRelease)({ report, inputs, revision, sourceRoot, output: path.join(destination, 'images') });
}
