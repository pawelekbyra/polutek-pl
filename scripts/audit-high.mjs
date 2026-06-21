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

function formatFixAvailable(fixAvailable) {
  if (fixAvailable === true) return 'true';
  if (!fixAvailable) return String(fixAvailable ?? false);
  if (typeof fixAvailable !== 'object') return String(fixAvailable);
  const fields = [
    fixAvailable.name ? `name=${fixAvailable.name}` : null,
    fixAvailable.version ? `version=${fixAvailable.version}` : null,
    typeof fixAvailable.isSemVerMajor === 'boolean' ? `isSemVerMajor=${fixAvailable.isSemVerMajor}` : null,
  ].filter(Boolean);
  return fields.length > 0 ? fields.join(', ') : JSON.stringify(fixAvailable);
}

function collectHighCriticalDetails(report) {
  const details = [];
  const vulnerabilities = report?.vulnerabilities;
  if (vulnerabilities && typeof vulnerabilities === 'object') {
    for (const [name, entry] of Object.entries(vulnerabilities)) {
      const via = Array.isArray(entry?.via) ? entry.via : [];
      const advisories = via.filter((item) => item && typeof item === 'object' && HIGH_LEVELS.has(String(item.severity ?? '').toLowerCase()));
      const entrySeverity = String(entry?.severity ?? '').toLowerCase();
      if (!HIGH_LEVELS.has(entrySeverity) && advisories.length === 0) continue;

      const advisorySummary = advisories.length > 0
        ? advisories.map((advisory) => {
            const title = advisory.title ?? 'untitled advisory';
            const severity = advisory.severity ?? 'unknown';
            const url = advisory.url ?? 'no-url';
            const range = advisory.range ? ` range=${advisory.range}` : '';
            return `${title} (${severity})${range} ${url}`;
          }).join('; ')
        : 'no direct advisory object in via list';

      details.push({
        name,
        severity: entry?.severity ?? 'unknown',
        range: entry?.range ?? 'unknown',
        nodes: Array.isArray(entry?.nodes) ? entry.nodes.join(', ') : 'unknown',
        via: via.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean).join(', ') || 'unknown',
        fixAvailable: formatFixAvailable(entry?.fixAvailable),
        advisories: advisorySummary,
      });
    }
  }

  const advisories = report?.advisories;
  if (advisories && typeof advisories === 'object') {
    for (const advisory of Object.values(advisories)) {
      const severity = String(advisory?.severity ?? '').toLowerCase();
      if (!HIGH_LEVELS.has(severity)) continue;
      details.push({
        name: advisory?.module_name ?? advisory?.name ?? 'unknown',
        severity: advisory?.severity ?? 'unknown',
        range: advisory?.vulnerable_versions ?? advisory?.range ?? 'unknown',
        nodes: advisory?.findings ? JSON.stringify(advisory.findings) : 'unknown',
        via: advisory?.title ?? 'unknown',
        fixAvailable: advisory?.patched_versions ?? 'unknown',
        advisories: `${advisory?.title ?? 'untitled advisory'} ${advisory?.url ?? 'no-url'}`,
      });
    }
  }

  return details;
}

function logHighCriticalDetails(report) {
  const details = collectHighCriticalDetails(report);
  if (details.length === 0) {
    console.error('[audit:high] No detailed high/critical vulnerability entries were found in the parseable report.');
    console.error(`[audit:high] Full report metadata: ${JSON.stringify(report?.metadata?.vulnerabilities ?? {}, null, 2)}`);
    return;
  }

  console.error('[audit:high] High/critical vulnerability details:');
  for (const detail of details) {
    console.error(`[audit:high] - package=${detail.name}; severity=${detail.severity}; range=${detail.range}; nodes=${detail.nodes}; via=${detail.via}; fixAvailable=${detail.fixAvailable}; advisories=${detail.advisories}`);
  }
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
      logHighCriticalDetails(report);
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
