#!/usr/bin/env node
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
const forbidIncludes = (label, text, needle) => {
  if (text.includes(needle)) fail(`${label} must not include: ${needle}`);
  else pass(`${label} excludes: ${needle}`);
};
const requireRegex = (label, text, regex, message = String(regex)) => {
  if (!regex.test(text)) fail(`${label} must match: ${message}`);
  else pass(`${label} matches: ${message}`);
};
const count = (text, needle) => text.split(needle).length - 1;

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  'docs/roadmap/Active-Execution-Roadmap.md',
  'docs/roadmap/OWNER-TIMELINE.md',
  'docs/roadmap/Launch-Execution-Backlog.md',
  'docs/strategy/OWNER-DECISIONS.md',
  'docs/strategy/OWNER-LAUNCH-DECISIONS-001.md',
  'docs/tickets/ready/README.md',
  'docs/tickets/ready/OWNER-LAUNCH-DECISIONS-001-consolidate-launch-blocking-decisions.md',
  'docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md',
  'docs/templates/TICKET_TEMPLATE.md',
  'docs/templates/PR_REPORT_TEMPLATE.md',
  '.github/pull_request_template.md',
];
for (const file of requiredFiles) requireFile(file);

if (checks.some((check) => !check.ok)) {
  for (const check of checks) console.error(`${check.ok ? 'PASS' : 'FAIL'} ${check.message}`);
  process.exit(1);
}

const agents = read('AGENTS.md');
const readme = read('README.md');
const roadmap = read('docs/roadmap/Active-Execution-Roadmap.md');
const timeline = read('docs/roadmap/OWNER-TIMELINE.md');
const backlog = read('docs/roadmap/Launch-Execution-Backlog.md');
const owner = read('docs/strategy/OWNER-DECISIONS.md');
const launch = read('docs/strategy/OWNER-LAUNCH-DECISIONS-001.md');
const queue = read('docs/tickets/ready/README.md');
const historicalTicket = read('docs/tickets/ready/OWNER-LAUNCH-DECISIONS-001-consolidate-launch-blocking-decisions.md');
const runtimeTicket = read('docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md');
const ticketTemplate = read('docs/templates/TICKET_TEMPLATE.md');
const prReportTemplate = read('docs/templates/PR_REPORT_TEMPLATE.md');
const githubPrTemplate = read('.github/pull_request_template.md');

for (const phrase of [
  'Portable workspace baseline',
  'Product-policy supersession',
  'Owner-decision provenance',
  'Current-ticket source of truth',
  'Backlog versus executable queue',
  'Precision contract',
]) requireIncludes('AGENTS.md', agents, phrase);

for (const field of [
  'Decision source:',
  'Approved by:',
  'Approval date:',
  'Recorded by:',
  'Supersedes:',
  'Does not supersede:',
  'Implementation status:',
  'Legal status:',
  'Operator-evidence status:',
  'Launch status:',
]) requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, field);
requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, 'This record is product-policy truth.');
requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, 'It is not implementation evidence, legal approval, operator evidence,');

for (const text of [owner, launch]) {
  forbidIncludes('owner decision files', text, 'może prowadzić do nadania PatronGrant');
  forbidIncludes('owner decision files', text, 'may create PatronGrant');
  forbidIncludes('owner decision files', text, 'checkbox');
  requireIncludes('owner decision files', text, 'musi');
  requireIncludes('owner decision files', text, 'dokładnie jeden aktywny PatronGrant');
  requireIncludes('owner decision files', text, 'Payment pozostaje osobnym faktem finansowym');
  requireIncludes('owner decision files', text, 'nie narzuca');
  requireIncludes('owner decision files', text, 'konkretnego komponentu UI');
  requireIncludes('owner decision files', text, 'jednoznacznego');
  requireIncludes('owner decision files', text, 'potwierdzenia');
}

// Hardened dynamic parsing
const idMarker = 'CONTROL_PLANE_CURRENT_TICKET_ID';
const fileMarker = 'CONTROL_PLANE_CURRENT_TICKET_FILE';

if (count(queue, idMarker) !== 1) fail(`queue must contain exactly one ${idMarker} marker`);
if (count(queue, fileMarker) !== 1) fail(`queue must contain exactly one ${fileMarker} marker`);

const extractMarker = (text, marker) => {
  const regex = new RegExp(`<!--\\s*${marker}:\\s*([^\\s-][^>]*?)\\s*-->`);
  const match = text.match(regex);
  const val = match ? match[1].trim() : '';
  if (!val) fail(`empty or missing marker value: ${marker}`);
  return val;
};

const currentTicketId = extractMarker(queue, idMarker);
const currentTicketFile = extractMarker(queue, fileMarker);

const escapeRegex = (string) => string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
const escapedId = escapeRegex(currentTicketId);

requireIncludes('ready queue', queue, `<!-- ${idMarker}: ${currentTicketId} -->`);
requireIncludes('ready queue', queue, `<!-- ${fileMarker}: ${currentTicketFile} -->`);
requireFile(currentTicketFile);

const currentTicketContent = read(currentTicketFile);
requireIncludes('current ticket', currentTicketContent, `Ticket ID: ${currentTicketId}`);
requireRegex('current ticket', currentTicketContent, /Status\*\*: READY|Status:\s*READY/, 'status READY');
forbidIncludes('current ticket', currentTicketContent, 'Status: MERGED / ACCEPTED');

const readyRows = [...queue.matchAll(new RegExp(`^\\|[^\n]*${escapedId}[^\n]*\\|[^\n]*\`READY\`\\s*\\|$`, 'gm'))];
if (readyRows.length !== 1) fail(`queue must contain exactly one current-primary READY row for ${currentTicketId}, found ${readyRows.length}`);

// Historical owner ticket checks
requireIncludes('historical owner ticket', historicalTicket, 'MERGED / HISTORICAL');
requireIncludes('historical owner ticket', historicalTicket, 'PR #890');
requireIncludes('historical owner ticket', historicalTicket, '#891');
forbidIncludes('historical owner ticket', historicalTicket, 'Status: READY_FOR_REVIEW');

// Accepted LAUNCH-EMAIL-003 ticket checks
requireIncludes('accepted LAUNCH-EMAIL-003', runtimeTicket, 'Ticket ID: LAUNCH-EMAIL-003');
requireIncludes('accepted LAUNCH-EMAIL-003', runtimeTicket, 'Status: MERGED / ACCEPTED');
requireIncludes('accepted LAUNCH-EMAIL-003', runtimeTicket, 'Accepted PR: #899');
requireIncludes('accepted LAUNCH-EMAIL-003', runtimeTicket, 'Merge SHA: f7fc603183120895359e9e52464de2d01e100980');
requireIncludes('accepted LAUNCH-EMAIL-003', runtimeTicket, 'Public launch: NO_GO');

for (const phrase of [
  'Missing content-notification preference means NOT OPTED IN',
  'System emails must not add to Resend Audience',
  'Unsubscribe never revokes `PatronGrant`',
  'signed unsubscribe token',
  'Non-goals',
]) requireIncludes('LAUNCH-EMAIL-003', runtimeTicket, phrase);

const nonGoalsIndex = runtimeTicket.indexOf('## Non-goals');
const signedIndex = runtimeTicket.indexOf('signed unsubscribe token');
if (nonGoalsIndex === -1 || signedIndex === -1 || signedIndex < nonGoalsIndex) fail('signed unsubscribe token must appear in the Non-goals section');

for (const [label, text] of [['README.md', readme], ['Active roadmap', roadmap], ['Owner timeline', timeline]]) {
  forbidIncludes(label, text, 'OWNER-LAUNCH-DECISIONS-001 — Consolidate launch-blocking owner decisions');
  requireIncludes(label, text, 'docs/tickets/ready/README.md');
  requireIncludes(label, text, 'docs/roadmap/Launch-Execution-Backlog.md');
}

const closedDecisionContexts = [
  /partial refund[^\n|]*OWNER_DECISION_REQUIRED/i,
  /email[^\n|]*(content[- ]notifications|content notifications)[^\n|]*OWNER_DECISION_REQUIRED/i,
  /RPO\/RTO[^\n|]*OWNER_DECISION_REQUIRED/i,
  /alert channel[^\n|]*OWNER_DECISION_REQUIRED/i,
  /Cloudflare originals[^\n|]*OWNER_DECISION_REQUIRED/i,
  /(reactions|hearts)[^\n|]*OWNER_DECISION_REQUIRED/i,
];
for (const [label, text] of [['README.md', readme], ['Active roadmap', roadmap], ['Owner timeline', timeline], ['ready queue', queue]]) {
  for (const regex of closedDecisionContexts) requireRegex(`${label} closed-decision context`, text, /LEGAL_REVIEW_REQUIRED|IMPLEMENTATION_MISSING|OPERATOR_PENDING|BLOCKED_OPERATOR_ACCESS|MISSING \/ NOT_EXECUTED|RECORDED|HISTORICAL|SUPERSEDED|NOT_LAUNCH_CRITICAL/, 'valid post-decision status present');
  for (const regex of closedDecisionContexts) {
    if (regex.test(text)) fail(`${label} must not use OWNER_DECISION_REQUIRED for closed owner-decision context: ${regex}`);
    else pass(`${label} has no stale OWNER_DECISION_REQUIRED context: ${regex}`);
  }
}
requireIncludes('control plane docs', readme + roadmap + timeline + queue, 'LEGAL_REVIEW_REQUIRED');

for (const [label, text] of [
  ['README.md', readme],
  ['Active roadmap', roadmap],
  ['Owner timeline', timeline],
  ['Launch backlog', backlog],
  ['OWNER-LAUNCH-DECISIONS-001', launch],
]) requireIncludes(label, text, 'NO_GO');
for (const [label, text] of [['README.md', readme], ['Active roadmap', roadmap], ['Owner timeline', timeline], ['Launch backlog', backlog], ['OWNER-LAUNCH-DECISIONS-001', launch]]) {
  forbidIncludes(label, text, 'Public launch: GO');
  forbidIncludes(label, text, 'LAUNCH_READY');
  forbidIncludes(label, text, 'X7: CERTIFIED');
}

for (const workstream of [
  'Email consent boundary',
  'Signed unsubscribe',
  'Bounce/complaint suppression',
  'System email events',
  'Language persistence',
  'Referral notifications',
  'Runtime/provider privacy inventory',
  'Legal copy PL/EN',
  'Vercel production evidence',
  'Stripe production evidence',
  'Cloudflare production evidence',
  'Backup, restore and alerts',
  'X6.2',
  'X6.3',
  'X6.4',
  'X6.5',
  'X6.6',
  'X6.7',
  'X6.8',
  'X6 certification',
  'X7 Launch Evidence Pack',
  'X7 certification',
  'Final owner launch decision',
]) requireIncludes('Launch backlog', backlog, workstream);
requireIncludes('Launch backlog', backlog, 'This document is not an executable queue.');

requireIncludes('ticket template', ticketTemplate, 'Control-plane provenance');
requireIncludes('ticket template', ticketTemplate, 'Semantic preservation checklist');
requireIncludes('PR report template', prReportTemplate, 'Semantic Preservation Matrix');
requireIncludes('GitHub PR template', githubPrTemplate, 'Semantic Preservation Matrix');
requireIncludes('GitHub PR template', githubPrTemplate, 'Public launch remains `NO_GO`');

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.message}`);
if (checks.some((check) => !check.ok)) process.exit(1);
console.log('CONTROL_PLANE_CHECK: PASS');
