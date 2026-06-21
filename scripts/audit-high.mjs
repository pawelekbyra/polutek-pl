#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const HIGH_OR_CRITICAL = new Set(['high', 'critical']);

function runAudit(args) {
  const result = spawnSync('npm', ['audit', '--audit-level=high', '--json', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function parseAuditJson(output) {
  if (!output.trim()) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function vulnerabilityCounts(report) {
  const counts = report?.metadata?.vulnerabilities;
  return {
    high: Number(counts?.high ?? 0),
    critical: Number(counts?.critical ?? 0),
  };
}

function hasHighOrCriticalVulnerability(report) {
  const counts = vulnerabilityCounts(report);
  if (counts.high > 0 || counts.critical > 0) return true;

  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') return false;

  return Object.values(vulnerabilities).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (HIGH_OR_CRITICAL.has(String(entry.severity ?? '').toLowerCase())) return true;

    const via = Array.isArray(entry.via) ? entry.via : [];
    return via.some((advisory) => {
      if (!advisory || typeof advisory !== 'object') return false;
      return HIGH_OR_CRITICAL.has(String(advisory.severity ?? '').toLowerCase());
    });
  });
}

function hasAuditReport(report) {
  return Boolean(report && typeof report === 'object' && report.auditReportVersion);
}

function printAuditFailure(prefix, audit) {
  if (audit.error) console.error(`${prefix}: ${audit.error.message}`);
  if (audit.stderr.trim()) console.error(audit.stderr.trim());
  if (audit.stdout.trim()) console.error(audit.stdout.trim());
}

const online = runAudit([]);
const onlineReport = parseAuditJson(online.stdout);

if (hasHighOrCriticalVulnerability(onlineReport)) {
  console.error('npm audit reported high/critical vulnerabilities.');
  console.error(JSON.stringify(onlineReport, null, 2));
  process.exit(1);
}

if (online.status === 0 && hasAuditReport(onlineReport)) {
  console.log('npm audit passed online with no high/critical vulnerabilities.');
  process.exit(0);
}

if (hasAuditReport(onlineReport)) {
  printAuditFailure('npm audit online failed despite returning audit data', online);
  process.exit(1);
}

console.warn('npm audit online endpoint failed before returning advisory data; trying offline audit fallback.');
if (online.stderr.trim()) console.warn(online.stderr.trim());

const offline = runAudit(['--offline']);
const offlineReport = parseAuditJson(offline.stdout);

if (hasHighOrCriticalVulnerability(offlineReport)) {
  console.error('npm audit offline fallback reported high/critical vulnerabilities.');
  console.error(JSON.stringify(offlineReport, null, 2));
  process.exit(1);
}

if (offline.status === 0 && hasAuditReport(offlineReport)) {
  console.log('npm audit offline fallback passed with no high/critical vulnerabilities.');
  process.exit(0);
}

printAuditFailure('npm audit offline fallback did not produce a clean audit report', offline);
process.exit(1);
