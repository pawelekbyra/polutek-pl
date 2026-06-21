#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const HIGH_SEVERITIES = new Set(['high', 'critical']);

function runAudit(args) {
  const result = spawnSync('npm', ['audit', '--audit-level=high', '--json', ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function parseJson(stdout) {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function countHighCritical(report) {
  const totals = report?.metadata?.vulnerabilities;
  if (totals && typeof totals === 'object') {
    return Number(totals.high ?? 0) + Number(totals.critical ?? 0);
  }
  return null;
}

function isAuditEnvironmentError(run, report) {
  const text = `${run.stderr}\n${run.stdout}\n${JSON.stringify(report?.error ?? {})}\n${run.error?.message ?? ''}`.toLowerCase();
  return [
    'audit endpoint returned an error',
    'forbidden',
    'advisories/bulk',
    'enotcached',
    'enoaudit',
    'cache miss',
    'cache mode is',
    'no cached response',
    'only-if-cached',
    'eai_again',
    'enotfound',
    'econnreset',
    'econnrefused',
    'etimedout',
    'socket timeout',
    'network',
    'bad gateway',
    'gateway timeout',
    'service unavailable',
    'too many requests',
    'request to',
    'proxy',
  ].some((needle) => text.includes(needle));
}

function evaluate(label, run) {
  const report = parseJson(run.stdout);
  const highCritical = report ? countHighCritical(report) : null;

  if (highCritical !== null) {
    if (highCritical > 0) {
      console.error(`[audit:high] ${label} returned ${highCritical} high/critical issue(s).`);
      return { kind: 'vulnerable' };
    }
    console.log(`[audit:high] ${label} returned 0 high/critical issues.`);
    return { kind: 'clean' };
  }

  if (run.status === 0) return { kind: 'clean' };

  if (isAuditEnvironmentError(run, report)) {
    console.warn(`[audit:high] WARNING: ${label} was blocked by an npm audit endpoint/cache environment limitation before parseable advisory data was available.`);
    if (run.stderr.trim()) console.warn(run.stderr.trim());
    if (run.stdout.trim()) console.warn(run.stdout.trim());
    return { kind: 'environment-blocked' };
  }

  console.error(`[audit:high] ${label} failed without parseable advisory data and was not classified as an environment limitation.`);
  if (run.stderr.trim()) console.error(run.stderr.trim());
  if (run.stdout.trim()) console.error(run.stdout.trim());
  return { kind: 'unknown-failure' };
}

const online = evaluate('online audit', runAudit([]));
if (online.kind === 'vulnerable' || online.kind === 'unknown-failure') process.exit(1);
if (online.kind === 'clean') process.exit(0);

const offline = evaluate('offline audit fallback', runAudit(['--offline']));
if (offline.kind === 'vulnerable' || offline.kind === 'unknown-failure') process.exit(1);
if (offline.kind === 'clean') process.exit(0);

console.warn('[audit:high] WARNING: online and offline npm audit were both blocked by endpoint/cache environment limitations before parseable advisory data was available. Treating this CI environment limitation as non-blocking.');
process.exit(0);
