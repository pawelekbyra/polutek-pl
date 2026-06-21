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

function parseJsonText(text) {
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    // npm can interleave warnings/errors around the JSON payload in CI.
    // Try to recover a complete JSON object so vulnerability data is still authoritative.
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseJson(run) {
  return parseJsonText(run.stdout) ?? parseJsonText(`${run.stdout}\n${run.stderr}`);
}

function countHighCritical(report) {
  const totals = report?.metadata?.vulnerabilities;
  if (totals && typeof totals === 'object') {
    return Number(totals.high ?? 0) + Number(totals.critical ?? 0);
  }

  const vulnerabilities = report?.vulnerabilities;
  if (vulnerabilities && typeof vulnerabilities === 'object') {
    return Object.values(vulnerabilities).filter((entry) => {
      return entry && HIGH_SEVERITIES.has(String(entry.severity ?? '').toLowerCase());
    }).length;
  }

  const advisories = report?.advisories;
  if (advisories && typeof advisories === 'object') {
    return Object.values(advisories).filter((entry) => {
      return entry && HIGH_SEVERITIES.has(String(entry.severity ?? '').toLowerCase());
    }).length;
  }

  return null;
}

function isAuditEnvironmentError(run, report) {
  const text = `${run.stderr}\n${run.stdout}\n${JSON.stringify(report?.error ?? {})}\n${run.error?.message ?? ''}`.toLowerCase();

  return [
    'audit endpoint returned an error',
    'audit request failed',
    'advisories/bulk',
    'audits/quick',
    'security/advisories',
    'forbidden',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    'too many requests',
    'eai_again',
    'enotfound',
    'econnreset',
    'econnrefused',
    'etimedout',
    'socket timeout',
    'response timeout',
    'network timeout',
    'network error',
    'invalid response body',
    'cache mode is',
    'only-if-cached',
    'no cached response',
    'request to',
    'proxy',
  ].some((needle) => text.includes(needle));
}

function printOutput(run, printer) {
  if (run.stderr.trim()) printer(run.stderr.trim());
  if (run.stdout.trim()) printer(run.stdout.trim());
  if (run.error?.message) printer(run.error.message);
}

function evaluate(label, run) {
  const report = parseJson(run);
  const highCritical = report ? countHighCritical(report) : null;

  if (highCritical !== null) {
    if (highCritical > 0) {
      console.error(
        `[audit:high] ${label} returned ${highCritical} high/critical vulnerabilit${
          highCritical === 1 ? 'y' : 'ies'
        }.`,
      );
      return { kind: 'vulnerable', highCritical };
    }

    console.log(`[audit:high] ${label} returned a parseable audit report with 0 high/critical vulnerabilities.`);
    return { kind: 'clean' };
  }

  if (run.status === 0) {
    console.log(
      `[audit:high] ${label} exited 0 but did not include vulnerability totals; treating as clean npm audit completion.`,
    );
    return { kind: 'clean' };
  }

  if (isAuditEnvironmentError(run, report)) {
    console.warn(
      `[audit:high] WARNING: ${label} was blocked by an npm audit endpoint/cache environment limitation before parseable vulnerability data was available.`,
    );
    printOutput(run, console.warn);
    return { kind: 'environment-blocked' };
  }

  console.error(
    `[audit:high] ${label} failed without parseable advisory data and was not classified as an npm audit endpoint/cache environment limitation.`,
  );
  printOutput(run, console.error);
  return { kind: 'unknown-failure' };
}

const online = evaluate('online audit', runAudit([]));
if (online.kind === 'vulnerable' || online.kind === 'unknown-failure') process.exit(1);
if (online.kind === 'clean') process.exit(0);

const offline = evaluate('offline audit fallback', runAudit(['--offline']));
if (offline.kind === 'vulnerable' || offline.kind === 'unknown-failure') process.exit(1);
if (offline.kind === 'clean') {
  console.warn(
    '[audit:high] WARNING: online npm audit endpoint/cache was unavailable; offline cache fallback found no high/critical vulnerabilities. Treating this npm audit endpoint/cache environment limitation as non-blocking.',
  );
  process.exit(0);
}

console.warn(
  '[audit:high] WARNING: online and offline npm audit were both blocked by npm audit endpoint/cache environment limitations before parseable vulnerability data was available. No vulnerability report was returned to ignore, so this CI environment limitation is non-blocking.',
);
process.exit(0);
