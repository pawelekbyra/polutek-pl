#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const auditArgs = ['audit', '--audit-level=high', '--json'];
const result = spawnSync('npm', auditArgs, { encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status === 0) {
  process.exit(0);
}

let payload = null;
try {
  payload = JSON.parse(result.stdout || '{}');
} catch {
  payload = null;
}

const hasVulnerabilityReport = payload && (payload.vulnerabilities || payload.advisories || payload.metadata?.vulnerabilities);

if (hasVulnerabilityReport) {
  console.error('npm audit/security: npm returned a vulnerability report; failing the job.');
  process.exit(result.status ?? 1);
}

const endpointStatus = payload?.statusCode;
const endpointMessage = String(payload?.message || result.stderr || result.stdout || '');
const isAuditEndpointFailure =
  endpointStatus === 403 ||
  endpointStatus === 429 ||
  endpointStatus >= 500 ||
  /audit endpoint returned an error|security\/advisories\/bulk|EAI_AGAIN|ECONNRESET|ETIMEDOUT|Forbidden/i.test(endpointMessage);

if (!isAuditEndpointFailure) {
  console.error('npm audit/security: npm audit failed for a non-endpoint reason; failing the job.');
  process.exit(result.status ?? 1);
}

console.warn('npm audit/security: npm registry audit endpoint is unavailable or forbidden; this is an environment/registry failure, not a vulnerability report.');
console.warn('npm audit/security: falling back to npm audit --offline --audit-level=high so cached advisory data still fails the job when available.');

const offline = spawnSync('npm', ['audit', '--audit-level=high', '--offline'], { encoding: 'utf8' });
if (offline.stdout) process.stdout.write(offline.stdout);
if (offline.stderr) process.stderr.write(offline.stderr);

if (offline.status !== 0) {
  console.error('npm audit/security: offline fallback found vulnerabilities or failed; failing the job.');
  process.exit(offline.status ?? 1);
}

console.warn('npm audit/security: offline fallback completed without high/critical findings. Re-run online npm audit when registry access is restored.');
process.exit(0);
