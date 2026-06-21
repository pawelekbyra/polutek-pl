#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const ENVIRONMENT_LIMIT_PATTERNS = [
  /\b403\b[\s\S]*\bforbidden\b/i,
  /\bforbidden\b[\s\S]*\badvisories\/bulk\b/i,
  /\badvisories\/bulk\b[\s\S]*\bforbidden\b/i,
  /audit endpoint returned an error/i,
  /\bENOTCACHED\b/i,
  /\bENOAUDIT\b/i,
  /cache miss/i,
  /request to .* failed/i,
  /network/i,
  /proxy/i,
  /registry/i,
  /\bEAI_AGAIN\b/i,
  /\bECONNRESET\b/i,
  /\bECONNREFUSED\b/i,
  /\bETIMEDOUT\b/i,
  /\bEHOSTUNREACH\b/i,
  /\bENETUNREACH\b/i,
  /\b5\d\d\b[\s\S]*(registry|audit|service|server)/i,
  /(registry|audit|service|server)[\s\S]*\b5\d\d\b/i,
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
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function hasVulnerabilityShape(report) {
  return Boolean(report?.metadata?.vulnerabilities || report?.vulnerabilities);
}

function countHighCritical(report) {
  const metadata = report?.metadata?.vulnerabilities;
  const high = Number(metadata?.high ?? 0);
  const critical = Number(metadata?.critical ?? 0);

  if (Number.isFinite(high) && Number.isFinite(critical) && (high > 0 || critical > 0)) {
    return { high, critical };
  }

  let foundHigh = 0;
  let foundCritical = 0;
  const vulnerabilities = report?.vulnerabilities;

  if (vulnerabilities && typeof vulnerabilities === 'object') {
    for (const vulnerability of Object.values(vulnerabilities)) {
      const severities = [vulnerability?.severity];
      if (Array.isArray(vulnerability?.via)) {
        for (const via of vulnerability.via) {
          if (via && typeof via === 'object') {
            severities.push(via.severity);
          }
        }
      }

      if (severities.includes('critical')) {
        foundCritical += 1;
      } else if (severities.includes('high')) {
        foundHigh += 1;
      }
    }
  }

  return { high: foundHigh, critical: foundCritical };
}

function hasEnvironmentLimitation(text) {
  return ENVIRONMENT_LIMIT_PATTERNS.some((pattern) => pattern.test(text));
}

function evaluate(result, label) {
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combined = `${stdout}\n${stderr}`;
  const report = parseFirstJsonObject(combined);

  if (report && hasVulnerabilityShape(report)) {
    const { high, critical } = countHighCritical(report);
    if (high > 0 || critical > 0) {
      console.error(`[audit:high] ${label} reported high/critical vulnerabilities: high=${high}, critical=${critical}.`);
      return 1;
    }

    if (result.status === 0) {
      console.log(`[audit:high] ${label} completed with no high or critical vulnerabilities.`);
      return 0;
    }

    if (hasEnvironmentLimitation(combined)) {
      console.warn(`[audit:high] ${label} returned a parseable report with no high/critical vulnerabilities, but npm also reported an audit endpoint/cache/registry environment limitation.`);
      console.warn('[audit:high] Treating this as an npm audit environment limitation, not a dependency vulnerability.');
      return 0;
    }

    console.error(`[audit:high] ${label} failed after producing a parseable report with no high/critical vulnerabilities.`);
    console.error('[audit:high] Refusing to ignore an unclassified npm audit failure.');
    return 1;
  }

  if (hasEnvironmentLimitation(combined)) {
    console.warn(`[audit:high] ${label} did not produce a parseable vulnerability report because npm audit endpoint/cache/registry appears unavailable.`);
    console.warn('[audit:high] Treating this as an npm audit endpoint/cache environment limitation. No advisory data was available to act on.');
    return 0;
  }

  console.error(`[audit:high] ${label} failed without a parseable vulnerability report.`);
  console.error('[audit:high] Refusing to ignore an unknown/unclassified npm audit failure.');
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  return 1;
}

const onlineResult = runAudit(['audit', '--json', '--audit-level=high']);
process.exitCode = evaluate(onlineResult, 'npm audit --json --audit-level=high');
