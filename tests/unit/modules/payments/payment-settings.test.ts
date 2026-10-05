import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentsDb, createTestContext } from './fake-payments-db';

const db = createFakePaymentsDb();
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/modules/audit', () => ({ recordAuditEvent: vi.fn() }));

const { getPaymentCurrencyLimits, validatePaymentAmountMinorAsync } = await import('@/lib/payments/currency-settings');
const { updatePaymentSettings } = await import('@/lib/modules/payments/application/update-payment-settings.use-case');

beforeEach(() => {
  db.paymentCurrencySetting.rows.length = 0;
  vi.restoreAllMocks();
});

describe('payment currency settings: one minimum per currency', () => {
  it('uses the stored minimum the gate shows and the server enforces', async () => {
    db.paymentCurrencySetting.rows.push({ currency: 'PLN', minAmountMinor: 700, patronThresholdMinor: 5000, patronBoxMinMinor: null });

    const limits = await getPaymentCurrencyLimits();

    expect(limits.PLN).toMatchObject({ minAmountMinor: 700, minAmount: 7 });
    expect(limits.PLN).not.toHaveProperty('patronThresholdMinor');
    expect(await validatePaymentAmountMinorAsync(699, 'PLN')).toMatch(/zbyt niska/);
    expect(await validatePaymentAmountMinorAsync(700, 'PLN')).toBeNull();
  });

  it('a legacy tip-box minimum higher than the floor stays the minimum until the next save', async () => {
    db.paymentCurrencySetting.rows.push({ currency: 'EUR', minAmountMinor: 300, patronThresholdMinor: 500, patronBoxMinMinor: 400 });
    expect((await getPaymentCurrencyLimits()).EUR.minAmountMinor).toBe(400);
  });

  it('a minimum below the Stripe floor (PLN 2.00) is raised to it, so the intent is never refused by Stripe', async () => {
    db.paymentCurrencySetting.rows.push({ currency: 'PLN', minAmountMinor: 100, patronThresholdMinor: null, patronBoxMinMinor: null });

    expect((await getPaymentCurrencyLimits()).PLN.minAmountMinor).toBe(200);
    expect(await validatePaymentAmountMinorAsync(150, 'PLN')).toMatch(/zbyt niska/);
    expect(await validatePaymentAmountMinorAsync(200, 'PLN')).toBeNull();
  });

  it('saving writes the one minimum and clears the legacy columns', async () => {
    db.paymentCurrencySetting.rows.push({ currency: 'EUR', minAmountMinor: 300, patronThresholdMinor: 500, patronBoxMinMinor: 400 });

    const result = await updatePaymentSettings(
      { limits: [{ currency: 'EUR', minAmount: 2.5 }] },
      createTestContext(db, { type: 'admin', userId: 'admin_1' }),
    );

    expect(result.ok && result.data.EUR.minAmountMinor).toBe(250);
    expect(db.paymentCurrencySetting.rows[0]).toMatchObject({ minAmountMinor: 250, patronThresholdMinor: null, patronBoxMinMinor: null });
  });

  it('only admins may change it', async () => {
    const result = await updatePaymentSettings({ limits: [{ currency: 'EUR', minAmount: 1 }] }, createTestContext(db, { type: 'user', userId: 'u' }));
    expect(result.ok).toBe(false);
  });

  it('a database error is not hidden behind built-in defaults (PAY-41)', async () => {
    vi.spyOn(db.paymentCurrencySetting, 'findMany').mockRejectedValueOnce(new Error('db down'));
    await expect(getPaymentCurrencyLimits()).rejects.toThrow('db down');
  });
});
