#!/usr/bin/env node
// Docs structure guard. Successor of the retired multi-agent "control plane"
// validator (2026-07-02): it now protects the lean product documentation set
// instead of the historical process files.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const fail = (message) => checks.push({ ok: false, message });
const pass = (message) => checks.push({ ok: true, message });
const filePath = (file) => path.join(root, file);
const requireFile = (file) => {
  if (!existsSync(filePath(file))) fail(`missing required file: ${file}`);
  else pass(`required file exists: ${file}`);
};
const read = (file) => readFileSync(filePath(file), 'utf8');
const requireIncludes = (label, text, needle) => {
  if (!text.includes(needle)) fail(`${label} must include: ${needle}`);
  else pass(`${label} includes: ${needle}`);
};
const forbidFile = (file, reason) => {
  if (existsSync(filePath(file))) fail(`retired file must not exist (${reason}): ${file}`);
  else pass(`retired file absent: ${file}`);
};

// The living documentation set.
for (const file of [
  'CLAUDE.md',
  'README.md',
  'KNOWN_LIMITATIONS.md',
  'DEPLOY_CHECKLIST.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/tickets/ready/README.md',
  '.github/pull_request_template.md',
]) requireFile(file);

if (checks.some((check) => !check.ok)) {
  for (const check of checks) console.error(`${check.ok ? 'PASS' : 'FAIL'} ${check.message}`);
  process.exit(1);
}

// CLAUDE.md must keep its current-state and critical-invariants anchor sections.
const claude = read('CLAUDE.md');
for (const needle of [
  'Current State for Agents',
  'Critical Invariants',
  'PatronGrant',
  'fulfillPayment',
  'Never CDN-cache `/api/media-source`',
]) requireIncludes('CLAUDE.md', claude, needle);

// AGENTS.md stays a pointer, not a resurrected process document.
const agents = read('AGENTS.md');
requireIncludes('AGENTS.md', agents, 'CLAUDE.md');
if (agents.length > 4000) fail('AGENTS.md must stay a short pointer to CLAUDE.md (grew past 4000 chars)');
else pass('AGENTS.md stays a short pointer');

// Docs index must link the ticket queue and audits.
const docsIndex = read('docs/README.md');
for (const needle of ['tickets/ready/', 'audit/', 'KNOWN_LIMITATIONS.md']) {
  requireIncludes('docs/README.md', docsIndex, needle);
}

// Guard against the historical control plane creeping back in.
for (const [file, reason] of [
  ['docs/reports', 'reconciliation report tree retired 2026-07-02'],
  ['docs/roadmap', 'process roadmaps retired 2026-07-02'],
  ['docs/templates', 'certification templates retired 2026-07-02'],
  ['docs/governance/BOLEK-OPERATING-MODEL.md', 'operating model retired 2026-07-02'],
]) forbidFile(file, reason);

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.message}`);
if (checks.some((check) => !check.ok)) process.exit(1);
console.log('CONTROL_PLANE_CHECK: PASS');