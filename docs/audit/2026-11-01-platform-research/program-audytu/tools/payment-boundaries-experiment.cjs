/* Research only. Actual payment/pass/sales functions, actual Stripe HMAC SDK;
 * explicit in-memory DB/transaction/SQL model and fake provider/audit/email.
 * No Prisma runtime, HTTP, Stripe API, real money or production connection.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Stripe = require('stripe');
const base = 'docs/audit/2026-11-01-platform-research/program-audytu';
const inventory = new Map(fs.readFileSync(`${base}/INWENTARZ-PLIKOW.csv`, 'utf8').trim().split('\n').slice(1).map(line => { const c = line.split(','); return [c[0], c[4]]; }));
const hashes = {}, loaded = new Map(), boundaries = new Set();
function checked(file) {
  const bytes = fs.readFileSync(file);
  hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hashes[file], inventory.get(file), `Source changed: ${file}`);
  return bytes.toString();
}
const schema = checked('prisma/schema.prisma');
class KnownError extends Error { constructor(message, options) { super(message); Object.assign(this, options); } }
const enums = { Prisma: { PrismaClientKnownRequestError: KnownError } };
for (const name of ['PaymentStatus', 'WebhookEventStatus', 'PatronGrantSource']) {
  const body = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];
  enums[name] = Object.fromEntries(body.split('\n').map(s => s.trim()).filter(s => /^[A-Z][A-Z_0-9]*$/.test(s)).map(s => [s, s]));
}
const secret = crypto.randomBytes(24).toString('hex');
process.env.STRIPE_WEBHOOK_SECRET = secret;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_research_no_network';
for (const name of ['PREMIUM_PASS_STRIPE_SECRET_KEY', 'PREMIUM_PASS_STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY']) delete process.env[name];
let active, auditFailure = false;
const alerts = [], audits = [];
const noLog = { info() {}, warn() {}, error() {}, debug() {} };
const stubs = {
  '@prisma/client': () => enums,
  '@/lib/prisma': () => ({ prisma: undefined }),
  '@/lib/logger': () => ({ logger: noLog }),
  '@/lib/observability': () => ({ recordAlert: name => alerts.push(name), recordMetric() {}, startTimer: () => 0, recordDurationMetric() {} }),
  '@/lib/modules/audit': () => ({ recordAuditEvent: async (_ctx, event) => { if (auditFailure) throw new Error('SYNTHETIC_AUDIT_FAILURE'); audits.push(event.action); } }),
  '@/lib/modules/email': () => ({ sendBecomePatronEmail: async () => {}, sendDonationThankYouEmail: async () => {} }),
  '@/lib/modules/patron': () => ({ grantPatron: async () => { throw new Error('Unexpected supporter creation outside this experiment'); }, sendSupportThanksNotification: async () => {} }),
  '@/lib/modules/patron-zone': () => load('lib/modules/patron-zone/application/patron-grant.ts'),
  '@/lib/modules/authz': () => ({ authorize: async () => null }), // Sales checks only; no authorization claim.
  '@/lib/premiere': () => load('lib/modules/video/domain/premiere.ts'),
  '../infrastructure/stripe-client': () => ({ getStripeClient: () => ({ refunds: { list: async ({ payment_intent }) => ({ data: active.refunds.get(payment_intent) ?? [], has_more: false }) } }) }),
};
const allowed = new Set([
  'lib/modules/payments/application/fulfill-payment.use-case.ts', 'lib/modules/payments/application/handle-stripe-webhook.use-case.ts',
  'lib/modules/payments/application/handle-refund.use-case.ts', 'lib/modules/payments/application/sync-refunds.use-case.ts',
  'lib/modules/payments/application/handle-dispute.use-case.ts', 'lib/modules/payments/application/supporter-grant.ts',
  'lib/modules/payments/infrastructure/payment.repository.ts', 'lib/modules/payments/infrastructure/stripe-event-lock.service.ts',
  'lib/modules/payments/infrastructure/stripe-refunds.ts', 'lib/modules/payments/domain/payment.errors.ts',
  'lib/modules/payments/domain/payment.purpose.ts', 'lib/payments/stripe-key-sets.ts',
  'lib/modules/patron-zone/application/patron-grant.ts', 'lib/modules/patron-zone/domain/config.ts',
  'lib/modules/patron-zone/domain/pass-state.ts', 'lib/modules/patron-zone/infrastructure/pass-store.ts',
  'lib/modules/video/domain/premiere.ts', 'lib/constants.ts', 'lib/modules/shared/result.ts',
  'lib/modules/shared/app-error.ts', 'lib/platform-gates.ts', 'lib/modules/sales/application/sales.use-cases.ts',
  'lib/modules/sales/domain/split.ts', 'tests/unit/modules/payments/fake-payments-db.ts',
]);
function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  assert(allowed.has(file), `Unexpected source: ${file}`);
  const mod = { exports: {} }; loaded.set(file, mod);
  const js = ts.transpileModule(checked(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = spec => {
    if (stubs[spec]) { boundaries.add(`${file} => ${spec}`); return stubs[spec](); }
    if (spec === 'zod') return require('zod');
    if (spec === 'stripe') return Stripe;
    const target = spec.startsWith('@/') ? spec.slice(2) + '.ts' : path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) + '.ts';
    return load(target);
  };
  new vm.Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}
const { createFakePaymentsDb } = load('tests/unit/modules/payments/fake-payments-db.ts');
const { fulfillPayment } = load('lib/modules/payments/application/fulfill-payment.use-case.ts');
const { handleRefund } = load('lib/modules/payments/application/handle-refund.use-case.ts');
const { syncRefundsFromStripe } = load('lib/modules/payments/application/sync-refunds.use-case.ts');
const { handleDispute } = load('lib/modules/payments/application/handle-dispute.use-case.ts');
const { handleStripeWebhook } = load('lib/modules/payments/application/handle-stripe-webhook.use-case.ts');
const { parsePassRecord, passStateOf } = load('lib/modules/patron-zone/domain/pass-state.ts');
const { refundOrder } = load('lib/modules/sales/application/sales.use-cases.ts');
const NOW = new Date('2026-03-01T00:00:00.000Z');
const clone = x => structuredClone(x);
function scenario() {
  const db = createFakePaymentsDb();
  // Real Prisma returns snapshots, unlike the original unit fake's object references.
  for (const key of ['payment', 'stripeEvent', 'patronGrant', 'user', 'userPaymentTotal', 'appSetting']) {
    for (const method of ['findUnique', 'findFirst', 'findMany']) {
      const read = db[key][method].bind(db[key]);
      db[key][method] = async (...args) => clone(await read(...args));
    }
  }
  db.$executeRaw = async (parts, ...values) => {
    assert(parts.join('?').includes('GREATEST(0, "amountMinor" - ?)'), 'Unexpected SQL model request');
    const [amount, userId, currency] = values;
    const row = db.userPaymentTotal.rows.find(r => r.userId === userId && r.currency === currency);
    if (row) row.amountMinor = Math.max(0, row.amountMinor - amount);
    return row ? 1 : 0;
  };
  db.user.rows.push({ id: 'payer', email: 'fixture@example.invalid', language: 'pl' });
  const state = { db, now: new Date(NOW), refunds: new Map(), queue: Promise.resolve() };
  state.ctx = { prisma: db, actor: { type: 'system', reason: 'local research' }, now: () => new Date(state.now),
    db: { read: db, writeTransaction(fn) {
      const result = state.queue.then(async () => {
        const tables = ['payment', 'stripeEvent', 'patronGrant', 'user', 'userPaymentTotal', 'appSetting'];
        const snapshot = Object.fromEntries(tables.map(k => [k, clone(db[k].rows)]));
        try { return await fn(db); } catch (error) { for (const k of tables) db[k].rows.splice(0, db[k].rows.length, ...snapshot[k]); throw error; }
      });
      state.queue = result.catch(() => {}); return result;
    } } };
  active = state;
  return state;
}
function seed(s, id, product = 'ACCESS_30D', extra = {}) {
  const amount = product === 'ACCESS_LIFETIME' ? 2999 : 1499;
  const p = { id, userId: 'payer', creatorId: 'channel', stripeIntentId: `pi_${id}`, amountMinor: amount, currency: 'PLN', status: 'PENDING', refundedAmountMinor: 0,
    metadata: { purpose: 'premium_pass', productId: product, method: 'card', consents: { termsVersion: 'fixture', waiverAt: s.now.toISOString() } }, ...extra };
  s.db.payment.rows.push(p); return p;
}
const total = s => s.db.userPaymentTotal.rows.find(r => r.userId === 'payer' && r.currency === 'PLN')?.amountMinor ?? 0;
const pass = s => parsePassRecord(s.db.appSetting.rows.find(r => r.key === 'xp.premium_pass:payer')?.value);
const pay = (s, id) => s.db.payment.rows.find(r => r.id === id);
function input(p, extra = {}) { return { paymentId: p.id, stripeIntentId: p.stripeIntentId, metadataUserId: 'payer', amountMinor: p.amountMinor, currency: p.currency, ...extra }; }
async function fulfill(s, p, extra) { return fulfillPayment(input(p, extra), s.ctx); }
async function refund(s, p) {
  s.refunds.set(p.stripeIntentId, [{ id: `re_${p.id}`, amount: p.amountMinor, status: 'succeeded' }]);
  return syncRefundsFromStripe({ paymentId: p.id }, s.ctx);
}
const observations = [];
function record(name, data) { observations.push({ name, ...data }); }
async function main() {
  {
    const s = scenario(), p = seed(s, 'good');
    assert((await fulfill(s, p)).ok);
    const first = clone(pass(s));
    assert((await fulfill(s, p)).ok);
    assert.deepEqual(pass(s), first); assert.equal(total(s), 1499);
    record('fulfillment_replay_once', { status: pay(s, p.id).status, total_minor: total(s), payment_ids: pass(s).paymentIds.length, access: passStateOf(pass(s), s.now).state });
  }
  for (const [name, overrides] of [['amount', { amountMinor: 1 }], ['currency', { currency: 'USD' }], ['intent', { stripeIntentId: 'pi_foreign' }], ['user', { metadataUserId: 'foreign' }]]) {
    const s = scenario(), p = seed(s, `wrong_${name}`);
    const result = await fulfill(s, p, overrides);
    assert(!result.ok && pay(s, p.id).status === 'PENDING' && pass(s) === null && total(s) === 0);
    record(`mismatch_${name}_denied`, { accepted: false, payment_status: 'PENDING', grant_present: false });
  }
  {
    const s = scenario(), p = seed(s, 'unpaid');
    assert(!(await handleRefund({ paymentId: p.id, reportedRefundedMinor: p.amountMinor }, s.ctx)).ok);
    assert.equal(pay(s, p.id).status, 'PENDING'); assert.equal(total(s), 0);
    record('refund_before_fulfillment_retried', { accepted: false, total_minor: 0 });
  }
  {
    const s = scenario(), a = seed(s, 'active_a'), b = seed(s, 'active_b');
    await fulfill(s, a); await fulfill(s, b);
    const before = pass(s).expiresAt;
    await refund(s, a);
    assert.equal(pass(s).expiresAt, '2026-03-31T00:00:00.000Z');
    assert.equal(passStateOf(pass(s), s.now).state, 'active'); assert.equal(total(s), 1499);
    const after = clone(pass(s)); await refund(s, a); assert.deepEqual(pass(s), after);
    record('refund_one_of_two_contiguous_periods', { before_expiry: before, after_expiry: pass(s).expiresAt, access: 'active', total_minor: total(s), replay_unchanged: true });
  }
  {
    const s = scenario(); s.now = new Date('2026-01-01T00:00:00.000Z');
    const a = seed(s, 'expired_a'); await fulfill(s, a);
    s.now = new Date(NOW); const b = seed(s, 'new_b'); await fulfill(s, b);
    const before = clone(pass(s)); assert.equal(before.expiresAt, '2026-03-31T00:00:00.000Z');
    await refund(s, a);
    assert.equal(passStateOf(pass(s), s.now).state, 'expired'); assert.equal(pay(s, b.id).status, 'SUCCEEDED');
    record('refund_expired_period_removes_new_purchase', { finding: 'R31', before_expiry: before.expiresAt, after_expiry: pass(s).expiresAt, remaining_payment_status: pay(s, b.id).status, remaining_payment_ids: pass(s).paymentIds, access: 'expired', total_minor: total(s) });
  }
  {
    const s = scenario(), a = seed(s, 'life_a', 'ACCESS_LIFETIME'), b = seed(s, 'life_b', 'ACCESS_LIFETIME');
    await fulfill(s, a); await fulfill(s, b); assert(pass(s).lifetime);
    await refund(s, b);
    assert(!pass(s).lifetime && pay(s, a.id).status === 'SUCCEEDED');
    record('refund_latest_of_two_lifetime_payments', { finding: 'R31', lifetime: pass(s).lifetime, access: passStateOf(pass(s), s.now).state, remaining_payment_status: pay(s, a.id).status, remaining_payment_ids: pass(s).paymentIds,
      precondition: 'Two independently paid lifetime intents; checkout dispatch not executed. Repeated test purchases are explicitly allowed; live requires overlapping in-flight attempts.' });
  }
  {
    const s = scenario(), a = seed(s, 'old_life', 'ACCESS_LIFETIME'), b = seed(s, 'new_life', 'ACCESS_LIFETIME');
    await fulfill(s, a); await fulfill(s, b); await refund(s, a);
    assert(pass(s).lifetime && passStateOf(pass(s), s.now).state === 'active');
    record('refund_older_lifetime_keeps_latest', { lifetime: true, access: 'active' });
  }
  {
    const s = scenario(), p = seed(s, 'partial'); await fulfill(s, p); const first = clone(pass(s));
    await handleRefund({ paymentId: p.id, reportedRefundedMinor: 100 }, s.ctx);
    assert.deepEqual(pass(s), first);
    record('partial_refund_leaves_access_known_policy', { payment_status: pay(s, p.id).status, access: 'active', known_manual_policy: true });
  }
  {
    const s = scenario(), p = seed(s, 'reverted'); await fulfill(s, p); await refund(s, p);
    s.refunds.set(p.stripeIntentId, [{ id: 're_failed', amount: p.amountMinor, status: 'failed' }]);
    await syncRefundsFromStripe({ paymentId: p.id }, s.ctx);
    assert.equal(pay(s, p.id).status, 'SUCCEEDED'); assert.equal(passStateOf(pass(s), s.now).state, 'expired');
    record('failed_refund_needs_manual_access_restore', { payment_status: 'SUCCEEDED', access: 'expired', known_manual_policy: true });
  }
  for (const lostFirst of [false, true]) {
    const s = scenario(); const a = seed(s, 'dispute_a', 'ACCESS_30D', { amountMinor: 1000, metadata: {}, status: 'SUCCEEDED' });
    seed(s, 'other_tip', 'ACCESS_30D', { amountMinor: 500, metadata: {}, status: 'SUCCEEDED' });
    s.db.userPaymentTotal.rows.push({ userId: 'payer', currency: 'PLN', amountMinor: 1500 });
    s.refunds.set(a.stripeIntentId, [{ id: 're_partial', amount: 400, status: 'succeeded' }]);
    const loss = () => handleDispute({ stripeIntentId: a.stripeIntentId, disputeId: 'dp_fixture', status: 'lost' }, s.ctx);
    const sync = () => syncRefundsFromStripe({ paymentId: a.id }, s.ctx);
    if (lostFirst) { assert((await loss()).ok); assert((await sync()).ok); } else { assert((await sync()).ok); assert((await loss()).ok); }
    assert.equal(total(s), lostFirst ? 100 : 500);
    record(lostFirst ? 'late_refund_sync_after_lost_dispute' : 'refund_sync_before_lost_dispute_control', { finding: lostFirst ? 'R32' : null, expected_other_tip_total_minor: 500, actual_total_minor: total(s), refunded_minor: pay(s, a.id).refundedAmountMinor, status: pay(s, a.id).status,
      limit: 'Sequential local delivery histories and explicit GREATEST SQL model; no real Stripe refund/dispute lifecycle or PostgreSQL.' });
  }
  {
    const s = scenario(), p = seed(s, 'signed');
    const event = { id: 'evt_fixture', object: 'event', created: Math.floor(Date.now()/1000), livemode: false, type: 'payment_intent.succeeded', data: { object: { id: p.stripeIntentId, amount: p.amountMinor, currency: 'pln', metadata: { paymentId: p.id, userId: 'payer' } } } };
    const body = JSON.stringify(event), signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    const invalid = await handleStripeWebhook({ body: body + ' ', signature }, s.ctx);
    assert(!invalid.ok && pass(s) === null);
    const valid = await handleStripeWebhook({ body, signature }, s.ctx);
    const replay = await handleStripeWebhook({ body, signature }, s.ctx);
    assert(valid.ok && replay.ok && replay.data.outcome === 'duplicate' && total(s) === 1499);
    record('real_sdk_signature_tamper_and_duplicate', { modified_body_accepted: false, valid_outcome: valid.data.outcome, replay_outcome: replay.data.outcome, total_minor: total(s) });
  }
  // R17: actual future sales function, provider is deliberately a non-deduplicating fake.
  async function salesScenario(mode) {
    const s = scenario(); const order = { id: 'order', channelId: 'channel', currency: 'PLN', providerRef: 'provider-order', status: 'PAID', grossMinor: 1000, creatorShareMinor: 700, refundedMinor: 0 };
    const entries = [], calls = []; let release, arrived;
    const both = new Promise(r => { arrived = r; }), gate = new Promise(r => { release = r; });
    s.db.order = { findUnique: async () => clone(order), updateMany: async ({ where, data }) => {
      if (order.refundedMinor !== where.refundedMinor) return { count: 0 };
      Object.assign(order, data); return { count: 1 };
    } };
    s.db.ledgerEntry = { create: async ({ data }) => { entries.push(clone(data)); return data; } };
    s.db.entitlement = { updateMany: async () => ({ count: 1 }) };
    const issueRefund = async (ref, amount) => {
      calls.push({ ref, amount });
      if (mode === 'parallel') { if (calls.length === 2) arrived(); await gate; }
      if (mode === 'failure') throw new Error('SYNTHETIC_PROVIDER_REJECTION');
    };
    const args = [s.ctx, { orderId: 'order', amountMinor: 300, reason: 'Synthetic customer request' }, { issueRefund }, mode === 'closed' ? {} : { PLATFORM_GATE_SALES: 'on' }];
    if (mode === 'parallel') {
      const first = refundOrder(...args), second = refundOrder(...args); await both; release();
      const outcomes = await Promise.allSettled([first, second]);
      assert.equal(calls.length, 2); assert.equal(order.refundedMinor, 300); assert.equal(entries.length, 1);
      assert.equal(outcomes.filter(r => r.status === 'rejected').length, 1);
      record('sales_parallel_refunds_external_before_cas', { finding: 'R17', fake_provider_operations: calls.length, fake_provider_refunded_minor: calls.reduce((n,c)=>n+c.amount,0), local_refunded_minor: order.refundedMinor, local_ledger_entries: entries.length, rejected_calls: 1, operation_key_provided: Object.hasOwn(calls[0].ref, 'idempotencyKey') });
    } else {
      const result = await refundOrder(...args);
      assert(!result.ok && order.refundedMinor === 0 && entries.length === 0);
      assert.equal(calls.length, mode === 'closed' ? 0 : 1);
      record(`sales_${mode}_control`, { accepted: false, provider_calls: calls.length, local_refunded_minor: order.refundedMinor });
    }
  }
  await salesScenario('closed'); await salesScenario('failure'); await salesScenario('parallel');
  console.log(JSON.stringify({ date: '2026-11-01', actual_source_sha256: hashes, actual_stripe_sdk_version: JSON.parse(fs.readFileSync('node_modules/stripe/package.json','utf8')).version,
    explicit_boundaries: [...boundaries].sort(), observations, limits: ['No production, real money, Stripe API or HTTP route dispatch.', 'Prisma enums parsed from baseline schema; generated Prisma runtime not loaded.', 'In-memory queries return snapshots; transaction queue and rollback are explicit models, not real DB isolation/advisory/row locks.', 'Actual repository SQL decrement is an explicit GREATEST arithmetic model, not PostgreSQL execution.', 'Authorization for sales is an allow stub; gate-off is actual code; no authority/security sign-off.', 'Synthetic Stripe webhook signing secret exists only in this process and is never emitted.', 'Fixed ctx.now dates simulate purchase histories; no passage of real months, browser or CDN token expiry test.', 'R17 fake provider intentionally does not deduplicate; no claim of a duplicate live Stripe refund.', 'Known manual policies for partial/refund reversal/dispute are distinguished from new R31/R32.'] }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
