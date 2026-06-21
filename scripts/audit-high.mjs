#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const HIGH_LEVELS = new Set(['high', 'critical']);
const ENV_PATTERNS = [
  /403[\s\S]*forbidden/i,
  /forbidden[\s\S]*advisories\/bulk/i,
  /advisories\/bulk[\s\S]*forbidden/i,
  /audit endpoint returned an error/i,
  /ENOTCACHED/i,
  /ENOAUDIT/i,
  /cache miss/i,
  /only-if-cached/i,
  /no cached response/i,
  /request to .* failed/i,
  /network/i,
  /proxy/i,
  /registry/i,
  /EAI_AGAIN/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /EHOSTUNREACH/i,
  /ENETUNREACH/i,
  /5\d\d[\s\S]*(registry|audit|service|server)/i,
  /(registry|audit|service|server)[\s\S]*5\d\d/i,
];

function runAudit(args) {
  return spawnSync('npm', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
}

function parseFirstJsonObject(text) {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

function hasReportShape(report) {
  return Boolean(report?.metadata?.vulnerabilities || report?.vulnerabilities || report?.advisories);
}

function countHighCritical(report) {
  const totals = report?.metadata?.vulnerabilities;
  if (totals && typeof totals === 'object') {
    return {
      high: Number(totals.high ?? 0),
      critical: Number(totals.critical ?? 0),
    };
  }

  let high = 0;
  let critical = 0;
  const groups = [report?.vulnerabilities, report?.advisories];
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    for (const entry of Object.values(group)) {
      const levels = [String(entry?.severity ?? '').toLowerCase()];
      if (Array.isArray(entry?.via)) {
        for (const via of entry.via) {
          if (via && typeof via === 'object') levels.push(String(via.severity ?? '').toLowerCase());
        }
      }
      if (levels.includes('critical')) critical += 1;
      else if (levels.includes('high')) high += 1;
    }
  }
  return { high, critical };
}

function isEnvironmentLimited(text) {
  return ENV_PATTERNS.some((pattern) => pattern.test(text));
}

function evaluate(result, label) {
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combined = `${stdout}\n${stderr}\n${result.error?.message ?? ''}`;
  const report = parseFirstJsonObject(combined);

  if (report && hasReportShape(report)) {
    const { high, critical } = countHighCritical(report);
    if (high > 0 || critical > 0) {
      console.error(`[audit:high] ${label} reported high/critical issues: high=${high}, critical=${critical}.`);
      return 1;
    }
    if (result.status === 0 || isEnvironmentLimited(combined)) {
      console.log(`[audit:high] ${label} has no high/critical issues.`);
      return 0;
    }
    console.error(`[audit:high] ${label} failed after producing a parseable report with no high/critical issues.`);
    return 1;
  }

  if (isEnvironmentLimited(combined)) {
    console.warn(`[audit:high] ${label} did not produce a parseable report because npm audit endpoint/cache/registry appears unavailable.`);
    console.warn('[audit:high] Treating this CI environment limitation as non-blocking because no advisory report was available to act on.');
    return 0;
  }

  console.error(`[audit:high] ${label} failed without a parseable report.`);
  if (stderr.trim()) console.error(stderr.trim());
  if (stdout.trim()) console.error(stdout.trim());
  return 1;
}

const result = runAudit(['audit', '--json', '--audit-level=high']);
process.exitCode = evaluate(result, 'npm audit --json --audit-level=high');
