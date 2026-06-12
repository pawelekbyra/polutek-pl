#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

const checks = [];
const fail = (message) => checks.push({ ok: false, message });
const pass = (message) => checks.push({ ok: true, message });
const read = (path) => readFileSync(path, 'utf8');
const requireFile = (path) => {
  if (!existsSync(path)) fail(`missing required file: ${path}`);
  else pass(`found ${path}`);
};
const requireIncludes = (label, text, needle) => {
  if (!text.includes(needle)) fail(`${label} missing: ${needle}`);
  else pass(`${label} contains: ${needle}`);
};
const requireMatch = (label, text, regex) => {
  if (!regex.test(text)) fail(`${label} missing pattern: ${regex}`);
  else pass(`${label} matches: ${regex}`);
};

const files = [
  'docs/strategy/OWNER-DECISIONS.md',
  'docs/strategy/OWNER-LAUNCH-DECISIONS-001.md',
  'docs/tickets/ready/README.md',
  'docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md',
  'docs/templates/TICKET_TEMPLATE.md',
  'docs/templates/PR_REPORT_TEMPLATE.md',
  '.github/pull_request_template.md',
];
for (const file of files) requireFile(file);

if (checks.some((check) => !check.ok)) {
  for (const check of checks) console.error(`${check.ok ? 'PASS' : 'FAIL'} ${check.message}`);
  process.exit(1);
}

const owner = read('docs/strategy/OWNER-DECISIONS.md');
const launch = read('docs/strategy/OWNER-LAUNCH-DECISIONS-001.md');
const queue = read('docs/tickets/ready/README.md');
const runtimeTicket = read('docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md');
const ticketTemplate = read('docs/templates/TICKET_TEMPLATE.md');
const prReportTemplate = read('docs/templates/PR_REPORT_TEMPLATE.md');
const githubPrTemplate = read('.github/pull_request_template.md');

requireIncludes('OWNER-DECISIONS', owner, 'Polutek.pl is not a platform. Polutek.pl is a place.');
requireIncludes('OWNER-DECISIONS', owner, 'Payment != PatronGrant');
requireIncludes('OWNER-DECISIONS', owner, 'Subscription/email != Patron');
requireIncludes('OWNER-DECISIONS', owner, 'Active `PatronGrant` jest backendowym źródłem prawdy');
requireIncludes('OWNER-DECISIONS', owner, '`User.isPatron`, Clerk metadata, `Subscription`, `Payment` alone, Stripe state alone i frontend state');
requireIncludes('OWNER-DECISIONS', owner, 'nie wywoływać Cloudflare/Mux po źródło playbacku');
requireIncludes('OWNER-DECISIONS', owner, 'Widoczność komentarzy nie jest tym samym co uprawnienie do komentowania');
requireIncludes('OWNER-DECISIONS', owner, 'Unsubscribe z emaila nigdy nie cofa `PatronGrant`');
requireIncludes('OWNER-DECISIONS', owner, 'Każda manualna akcja wpływająca na dostęp wymaga reason + audit + confirmation');
requireIncludes('OWNER-DECISIONS', owner, 'Semantic preservation matrix');
requireIncludes('OWNER-DECISIONS', owner, 'Publiczny launch pozostaje: `NO_GO`');

requireMatch('OWNER-LAUNCH-DECISIONS-001', launch, /^Status: DECIDED$/m);
requireMatch('OWNER-LAUNCH-DECISIONS-001', launch, /^Implementation status: NOT IMPLEMENTED \/ PARTIAL$/m);
requireMatch('OWNER-LAUNCH-DECISIONS-001', launch, /^Legal status: PROFESSIONAL REVIEW REQUIRED$/m);
requireMatch('OWNER-LAUNCH-DECISIONS-001', launch, /^Launch status: NO_GO$/m);
requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, 'FIRST_TIP_AND_PATRON_GRANTED');
requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, 'Resend Audience');
requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, 'support@polutek.pl');

const recommended = [...queue.matchAll(/```txt\n([\s\S]*?)\n```/g)]
  .map((match) => match[1].trim())
  .filter(Boolean);
if (recommended.length === 0) fail('ready queue has no fenced recommended next ticket block');
const exactRecommended = recommended.filter((block) => block.includes('—'));
if (exactRecommended.length !== 1) fail(`ready queue must contain exactly one recommended next ticket block, found ${exactRecommended.length}`);
else pass('ready queue contains exactly one recommended next ticket block');
requireIncludes('ready queue', queue, 'LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior');
requireIncludes('ready queue', queue, 'This index is the sole source for the next executable ticket');
requireIncludes('ready queue', queue, 'OWNER-LAUNCH-DECISIONS-001-consolidate-launch-blocking-decisions.md');

requireIncludes('runtime ticket', runtimeTicket, 'Status**: READY');
requireIncludes('runtime ticket', runtimeTicket, 'This ticket is the sole new runtime ticket');
requireIncludes('runtime ticket', runtimeTicket, 'System emails must not add to Resend Audience');
requireIncludes('runtime ticket', runtimeTicket, 'Unsubscribe never revokes `PatronGrant`');
requireIncludes('runtime ticket', runtimeTicket, 'Public launch remains `NO_GO`');

requireIncludes('ticket template', ticketTemplate, 'Control-plane provenance');
requireIncludes('ticket template', ticketTemplate, 'Semantic preservation checklist');
requireIncludes('PR report template', prReportTemplate, 'Semantic Preservation Matrix');
requireIncludes('GitHub PR template', githubPrTemplate, 'Semantic Preservation Matrix');
requireIncludes('GitHub PR template', githubPrTemplate, 'Public launch remains `NO_GO`');

const forbiddenOwnerPhrases = [
  'Content notifications wymagają osobnego, świadomego opt-in (checkbox nie może być domyślnie zaznaczony).',
];
for (const phrase of forbiddenOwnerPhrases) {
  if (owner.includes(phrase)) fail(`OWNER-DECISIONS retains inferred checkbox requirement phrase: ${phrase}`);
  else pass(`OWNER-DECISIONS does not contain inferred checkbox-only phrasing`);
  if (launch.includes(phrase)) fail(`OWNER-LAUNCH-DECISIONS-001 retains inferred checkbox requirement phrase: ${phrase}`);
  else pass(`OWNER-LAUNCH-DECISIONS-001 does not contain inferred checkbox-only phrasing`);
}
requireIncludes('OWNER-DECISIONS', owner, 'decyzja właściciela nie narzuca konkretnego kontrolnego UI');
requireIncludes('OWNER-LAUNCH-DECISIONS-001', launch, 'decyzja właściciela nie narzuca konkretnego kontrolnego UI');

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.message}`);
}
if (checks.some((check) => !check.ok)) process.exit(1);
