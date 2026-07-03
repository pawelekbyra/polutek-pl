import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/cron/stripe-reconciliation/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import * as fulfillModule from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { ok, fail } from '@/lib/modules/shared/result';
import { PaymentError } from '@/lib/modules/payments/domain/payment.errors';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => await fn(prisma)),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createScopedLogger: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const mockRetrieve = vi.fn();

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        paymentIntents: {
          retrieve: mockRetrieve,
        },
      };
    }),
  };
});

describe('Stripe Reconciliation Cron', () => {
  const CRON_SECRET = 'test_cron_secret';
  const STRIPE_SECRET_KEY = 'sk_test';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY;
  });

  it('returns 401 if Authorization header is missing or incorrect', async () => {
    const req1 = new NextRequest('http://localhost/api/cron/stripe-reconciliation');
    const res1 = await GET(req1);
    expect(res1.status).toBe(401);

    const req2 = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: 'Bearer wrong_token' },
    });
    const res2 = await GET(req2);
    expect(res2.status).toBe(401);
  });

  it('processes PENDING payments and fulfills if Stripe status is succeeded', async () => {
    const mockPayment = {
      id: 'pay_1',
      stripeIntentId: 'pi_1',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago
      user: {
        patronGrants: [],
      },
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    mockRetrieve.mockResolvedValue({ status: 'succeeded', amount: 1000, currency: 'PLN' } as any);

    const fulfillSpy = vi.spyOn(fulfillModule, 'fulfillPayment').mockResolvedValue(ok({ isFirstFulfillment: true }));

    const req = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 1, updated: 1, errors: 0 });
    expect(fulfillSpy).toHaveBeenCalledWith({
      paymentId: 'pay_1',
      stripeIntentId: 'pi_1',
      amountMinor: 1000,
      currency: 'PLN',
    }, expect.anything());
  });

  it('updates status to FAILED if Stripe status is canceled', async () => {
    const mockPayment = {
      id: 'pay_2',
      stripeIntentId: 'pi_2',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
      user: {
        patronGrants: [],
      },
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    mockRetrieve.mockResolvedValue({ status: 'canceled' } as any);

    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 });

    const req = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 1, updated: 1, errors: 0 });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pay_2', status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    }));
  });

  it('updates status to FAILED if Stripe status is requires_payment_method and older than 24h', async () => {
    const mockPayment = {
      id: 'pay_3',
      stripeIntentId: 'pi_3',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      user: {
        patronGrants: [],
      },
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    mockRetrieve.mockResolvedValue({ status: 'requires_payment_method' } as any);

    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 });

    const req = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 1, updated: 1, errors: 0 });
    expect(prisma.payment.updateMany).toHaveBeenCalled();
  });

  it('skips if Stripe status is requires_payment_method and younger than 24h', async () => {
    const mockPayment = {
      id: 'pay_4',
      stripeIntentId: 'pi_4',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago
      user: {
        patronGrants: [],
      },
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    mockRetrieve.mockResolvedValue({ status: 'requires_payment_method' } as any);

    const req = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 1, updated: 0, errors: 0 });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('increments errors if Stripe API fails for a payment', async () => {
    const mockPayment = {
      id: 'pay_5',
      stripeIntentId: 'pi_5',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
      user: {
        patronGrants: [],
      },
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    mockRetrieve.mockRejectedValue(new Error('Stripe API Error'));

    const req = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 1, updated: 0, errors: 1 });
  });

  it('increments errors if fulfillPayment fails', async () => {
    const mockPayment = {
      id: 'pay_6',
      stripeIntentId: 'pi_6',
      amountMinor: 1000,
      currency: 'PLN',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
      user: {
        patronGrants: [],
      },
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    mockRetrieve.mockResolvedValue({ status: 'succeeded' } as any);

    vi.spyOn(fulfillModule, 'fulfillPayment').mockResolvedValue(fail(new PaymentError('Fulfillment failed')));

    const req = new NextRequest('http://localhost/api/cron/stripe-reconciliation', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 1, updated: 0, errors: 1 });
  });
});
