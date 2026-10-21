/**
 * experiment: premium-pass (docs/experiments/premium-pass.md, section 4): a simulated purchase (demo mode) on a real
 * Postgres writes exactly one AppSetting row and nothing into any money table.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts tests/postgres/premium-pass-ledgers.pg.test.ts
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkoutDemoPass, runPassDemoControl } from '@/lib/modules/experiment-premium-pass';
import { createAppContext } from '@/lib/modules/shared/app-context';

const prisma = new PrismaClient();
const userId = `pg-xpass-${Date.now().toString(36)}`;
const key = `xp.premium_pass:${userId}`;

async function ledgerCounts() {
  const [payment, patronGrant, order, entitlement, ledgerEntry, userPaymentTotal] = await Promise.all([
    prisma.payment.count(),
    prisma.patronGrant.count(),
    prisma.order.count(),
    prisma.entitlement.count(),
    prisma.ledgerEntry.count(),
    prisma.userPaymentTotal.count(),
  ]);
  return { payment, patronGrant, order, entitlement, ledgerEntry, userPaymentTotal };
}

beforeAll(() => {
  process.env.PREMIUM_PASS_EXPERIMENT = 'all';
  delete process.env.PREMIUM_PASS_PAYMENTS; // the default: demo
});

afterAll(async () => {
  delete process.env.PREMIUM_PASS_EXPERIMENT;
  await prisma.appSetting.deleteMany({ where: { key: { startsWith: 'xp.premium_pass' } } });
  await prisma.$disconnect();
});

describe('premium-pass demo purchase against the real schema', () => {
  it('writes one AppSetting row with provider DEMO and leaves every ledger untouched', async () => {
    const before = await ledgerCounts();
    const ctx = createAppContext({ actor: { type: 'user', userId }, prisma });
    const result = await checkoutDemoPass(ctx, {
      requestId: randomUUID(),
      productId: 'ACCESS_30D',
      currency: 'PLN',
      method: 'blik',
      consents: { terms: true, waiver: true },
      simulate: 'success',
    });
    expect(result.ok).toBe(true);
    const row = await prisma.appSetting.findUniqueOrThrow({ where: { key } });
    expect(JSON.parse(row.value)).toMatchObject({ v: 3, provider: 'DEMO', priceMinor: 1499, totalMinor: 1499, lifetime: false });

    const declined = await checkoutDemoPass(createAppContext({ actor: { type: 'user', userId: `${userId}-b` }, prisma }), {
      requestId: randomUUID(),
      productId: 'ACCESS_LIFETIME',
      currency: 'PLN',
      method: 'card',
      consents: { terms: true, waiver: true },
      simulate: 'declined',
    });
    expect(declined).toMatchObject({ ok: false, code: 'DEMO_DECLINED' });
    expect(await prisma.appSetting.findUnique({ where: { key: `${key}-b` } })).toBeNull();

    await runPassDemoControl(ctx, { action: 'reset' });
    expect(await prisma.appSetting.findUnique({ where: { key } })).toBeNull();
    expect(await ledgerCounts()).toEqual(before);
  });
});
