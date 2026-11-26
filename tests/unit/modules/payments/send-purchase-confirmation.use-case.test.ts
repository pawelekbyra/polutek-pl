/**
 * ensurePurchaseConfirmation(): the Premium "Potwierdzenie zakupu" mail goes out at most once per payment, and a
 * failed send is recorded and retried later, never lost silently and never able to fail the payment. The marker store
 * is replaced by an in-memory one with the same rules (the real SQL claim is tested on Postgres:
 * tests/postgres/premium-purchase-confirmation.pg.test.ts); the mail transport is a spy.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const recordAuditEvent = vi.fn();
const recordAlert = vi.fn();
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));
vi.mock('@/lib/observability', () => ({ recordAlert: (...args: unknown[]) => recordAlert(...args), recordMetric: vi.fn() }));
vi.mock('@/lib/modules/email', () => ({ sendPurchaseConfirmationEmail: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const { ensurePurchaseConfirmation } = await import('@/lib/modules/payments/application/send-purchase-confirmation.use-case');
const { CONFIRMATION_MAX_ATTEMPTS, CONFIRMATION_RETRY_AFTER_MS, CONFIRMATION_STALE_SENDING_MS, readConfirmationMarker } =
  await import('@/lib/modules/payments/infrastructure/purchase-confirmation.store');
import type { ClaimResult, PurchaseConfirmationStore } from '@/lib/modules/payments/infrastructure/purchase-confirmation.store';

type Row = { id: string; status: string; amountMinor: number; currency: string; metadata: Record<string, any> | null; user: { email: string; language: string; isDeleted: boolean } | null };
const rows = new Map<string, Row>();
let clock = new Date('2026-11-26T09:30:00.000Z');

/** Same rules as SqlPurchaseConfirmationStore.claim, on the in-memory rows (one synchronous step = atomic). */
const store: PurchaseConfirmationStore = {
  async claim(id, now): Promise<ClaimResult> {
    const row = rows.get(id);
    if (!row || row.status !== 'SUCCEEDED') return { claimed: false, reason: 'not_eligible' };
    const marker = readConfirmationMarker(row.metadata);
    const age = marker ? now.getTime() - new Date(marker.at).getTime() : 0;
    const open =
      !marker ||
      (marker.state === 'failed' && marker.attempts < CONFIRMATION_MAX_ATTEMPTS && age >= CONFIRMATION_RETRY_AFTER_MS) ||
      (marker.state === 'sending' && marker.attempts < CONFIRMATION_MAX_ATTEMPTS && age >= CONFIRMATION_STALE_SENDING_MS);
    if (!open) {
      if (marker!.state === 'sent') return { claimed: false, reason: 'sent' };
      return { claimed: false, reason: marker!.attempts >= CONFIRMATION_MAX_ATTEMPTS ? 'exhausted' : 'busy' };
    }
    const next = { state: 'sending', attempts: (marker?.attempts ?? 0) + 1, at: now.toISOString(), paidAt: marker?.paidAt ?? now.toISOString() };
    row.metadata = { ...(row.metadata ?? {}), purchaseConfirmation: next };
    return { claimed: true, attempts: next.attempts, paidAt: new Date(next.paidAt) };
  },
  async markSent(id, now) {
    const row = rows.get(id)!;
    const { error: _error, ...marker } = row.metadata!.purchaseConfirmation;
    row.metadata = { ...row.metadata, purchaseConfirmation: { ...marker, state: 'sent', at: now.toISOString(), sentAt: now.toISOString() } };
  },
  async markFailed(id, now, error) {
    const row = rows.get(id)!;
    row.metadata = { ...row.metadata, purchaseConfirmation: { ...row.metadata!.purchaseConfirmation, state: 'failed', at: now.toISOString(), error } };
  },
};

const send = vi.fn();
const deps = { store, send: send as never };
const ctx = () => ({
  actor: { type: 'system', reason: 'test' },
  now: () => clock,
  prisma: {},
  db: {
    read: { payment: { findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null } },
    writeTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}) as never;

function seed(overrides: Partial<Row> & { metadata?: Record<string, any> | null } = {}): Row {
  const row: Row = {
    id: `pay_${rows.size + 1}`,
    status: 'SUCCEEDED',
    amountMinor: 1499,
    currency: 'PLN',
    metadata: { purpose: 'premium_pass', productId: 'ACCESS_30D', consents: { termsVersion: 'v1', waiverAt: '2026-11-26T09:28:00.000Z' } },
    user: { email: 'buyer@example.com', language: 'pl', isDeleted: false },
    ...overrides,
  };
  rows.set(row.id, row);
  return row;
}
const ensure = (row: Row) => ensurePurchaseConfirmation({ paymentId: row.id }, ctx(), deps);

beforeEach(() => {
  rows.clear();
  clock = new Date('2026-11-26T09:30:00.000Z');
  vi.clearAllMocks();
  send.mockResolvedValue({ ok: true });
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_unit_test_key');
});
afterEach(() => vi.unstubAllEnvs());

describe('ensurePurchaseConfirmation', () => {
  it('sends the confirmation once, with the facts of the order, and records it as sent', async () => {
    const row = seed();

    expect(await ensure(row)).toEqual({ status: 'sent' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: 'buyer@example.com',
      language: 'pl',
      orderNumber: row.id,
      serviceName: 'Dostęp Premium na 30 dni',
      amountMinor: 1499,
      currency: 'PLN',
      paidAt: clock,
      waiverAt: new Date('2026-11-26T09:28:00.000Z'),
      vatExempt: true,
      sellerName: 'Paweł Perfect',
      testMode: false,
    });
    expect(readConfirmationMarker(row.metadata)).toMatchObject({ state: 'sent', attempts: 1, sentAt: clock.toISOString() });
    expect(row.metadata).toMatchObject({ purpose: 'premium_pass', productId: 'ACCESS_30D' }); // other metadata untouched
  });

  it('the 3-month plan and an English account', async () => {
    const row = seed({ metadata: { purpose: 'premium_pass', productId: 'ACCESS_LIFETIME' }, user: { email: 'b@example.com', language: 'de', isDeleted: false } });
    await ensure(row);
    expect(send.mock.calls[0][0]).toMatchObject({ language: 'en', serviceName: 'Premium access for 3 months', waiverAt: null });
    const pl = seed({ metadata: { purpose: 'premium_pass', productId: 'ACCESS_LIFETIME' } });
    await ensure(pl);
    expect(send.mock.calls[1][0]).toMatchObject({ language: 'pl', serviceName: 'Dostęp Premium na 3 miesiące' });
  });

  it('a second call, and many at once, send nothing more', async () => {
    const row = seed();
    const first = await Promise.all([ensure(row), ensure(row), ensure(row), ensure(row), ensure(row)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(first.filter((o) => o.status === 'sent')).toHaveLength(1);
    expect(await ensure(row)).toEqual({ status: 'skipped', reason: 'already_sent' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing for a tip, an unpaid payment, a refunded one or a deleted account', async () => {
    const tip = seed({ metadata: null });
    const pending = seed({ status: 'PENDING' });
    const refunded = seed({ status: 'REFUNDED' });
    const gone = seed({ user: { email: 'x@example.com', language: 'pl', isDeleted: true } });

    expect(await ensure(tip)).toEqual({ status: 'skipped', reason: 'not_premium' });
    expect(await ensure(pending)).toEqual({ status: 'skipped', reason: 'not_paid' });
    expect(await ensure(refunded)).toEqual({ status: 'skipped', reason: 'not_paid' });
    expect(await ensure(gone)).toEqual({ status: 'skipped', reason: 'no_recipient' });
    expect(await ensurePurchaseConfirmation({ paymentId: 'nope' }, ctx(), deps)).toEqual({ status: 'skipped', reason: 'not_premium' });
    expect(send).not.toHaveBeenCalled();
  });

  it('Stripe test keys: the mail is marked as a test order (default and premium key sets)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit_test_key');
    await ensure(seed());
    expect(send.mock.calls[0][0].testMode).toBe(true);

    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_unit_test_key');
    vi.stubEnv('PREMIUM_PASS_STRIPE_SECRET_KEY', 'sk_test_premium_unit_key');
    await ensure(seed({ metadata: { purpose: 'premium_pass', productId: 'ACCESS_30D', stripeKeySet: 'premium' } }));
    expect(send.mock.calls[1][0].testMode).toBe(true);
    await ensure(seed()); // default set on live keys: a real order
    expect(send.mock.calls[2][0].testMode).toBe(false);
  });

  it('an unknown key kind never hides a real purchase behind the test banner', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'something-else');
    await ensure(seed());
    expect(send.mock.calls[0][0].testMode).toBe(false);
  });

  it('a failed send is recorded (marker, audit, alert), does not throw, and is not retried at once', async () => {
    send.mockResolvedValue({ ok: false, error: 'provider down' });
    const row = seed();

    expect(await ensure(row)).toEqual({ status: 'failed', error: 'provider down' });

    expect(readConfirmationMarker(row.metadata)).toMatchObject({ state: 'failed', attempts: 1, error: 'provider down' });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'EMAIL_SEND_FAILED', targetType: 'Payment', targetId: row.id,
      metadata: expect.objectContaining({ emailType: 'purchase_confirmation', attempt: 1, error: 'provider down' }),
    }));
    expect(recordAlert).toHaveBeenCalledWith('premium_pass.confirmation_email_failed', expect.objectContaining({ paymentId: row.id }));
    expect(await ensure(row)).toEqual({ status: 'skipped', reason: 'busy' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a thrown error from the transport counts as a failed send', async () => {
    send.mockRejectedValue(new Error('socket hang up'));
    const row = seed();
    expect(await ensure(row)).toEqual({ status: 'failed', error: 'socket hang up' });
    expect(readConfirmationMarker(row.metadata)?.state).toBe('failed');
  });

  it('a later event retries a failed send after the pause; the order date stays the first one', async () => {
    send.mockResolvedValueOnce({ ok: false, error: 'provider down' });
    const row = seed();
    const firstClock = clock;
    await ensure(row);

    clock = new Date(clock.getTime() + CONFIRMATION_RETRY_AFTER_MS + 1000);
    expect(await ensure(row)).toEqual({ status: 'sent' });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].paidAt).toEqual(firstClock);
    expect(readConfirmationMarker(row.metadata)).toMatchObject({ state: 'sent', attempts: 2 });
    expect(readConfirmationMarker(row.metadata)).not.toHaveProperty('error');
  });

  it('gives up after the attempt limit and alerts the owner', async () => {
    send.mockResolvedValue({ ok: false, error: 'provider down' });
    const row = seed();
    for (let i = 0; i < CONFIRMATION_MAX_ATTEMPTS; i += 1) {
      await ensure(row);
      clock = new Date(clock.getTime() + CONFIRMATION_RETRY_AFTER_MS + 1000);
    }
    expect(send).toHaveBeenCalledTimes(CONFIRMATION_MAX_ATTEMPTS);

    expect(await ensure(row)).toEqual({ status: 'skipped', reason: 'exhausted' });
    expect(send).toHaveBeenCalledTimes(CONFIRMATION_MAX_ATTEMPTS);
    expect(recordAlert).toHaveBeenCalledWith('premium_pass.confirmation_email_gave_up', { paymentId: row.id });
  });

  it('a claim left `sending` by a dead process is taken over after the stale time, not before', async () => {
    const row = seed();
    row.metadata = { ...row.metadata!, purchaseConfirmation: { state: 'sending', attempts: 1, at: clock.toISOString(), paidAt: clock.toISOString() } };
    expect(await ensure(row)).toEqual({ status: 'skipped', reason: 'busy' });
    clock = new Date(clock.getTime() + CONFIRMATION_STALE_SENDING_MS + 1000);
    expect(await ensure(row)).toEqual({ status: 'sent' });
  });

  it('never throws, whatever breaks (the payment is already recorded)', async () => {
    const row = seed();
    const broken: PurchaseConfirmationStore = { ...store, claim: async () => { throw new Error('db down'); } };
    expect(await ensurePurchaseConfirmation({ paymentId: row.id }, ctx(), { store: broken, send: send as never }))
      .toEqual({ status: 'failed', error: 'db down' });
    recordAuditEvent.mockRejectedValueOnce(new Error('audit down'));
    send.mockResolvedValue({ ok: false, error: 'x' });
    await expect(ensure(seed())).resolves.toMatchObject({ status: 'failed' });
  });
});
