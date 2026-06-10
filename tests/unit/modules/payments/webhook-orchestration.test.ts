import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStripeWebhook } from '@/lib/modules/payments/application/handle-stripe-webhook.use-case';
import { WebhookEventStatus, Prisma } from '@prisma/client';

// Mock Stripe correctly using a dummy class
vi.mock('stripe', () => {
  return {
    default: class {
        webhooks = {
            constructEvent: vi.fn().mockReturnValue({
                id: 'evt_123',
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_123', amount: 1000, currency: 'pln', metadata: { paymentId: 'pay_123', userId: 'user_123' } } }
            })
        }
    }
  };
});

describe('handleStripeWebhook', () => {
  let mockPrisma: any;
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test';

    mockPrisma = {
        stripeEvent: {
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn()
        },
        payment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ id: 'pay_123', amountMinor: 1000, currency: 'pln', status: 'PENDING' }),
            update: vi.fn().mockResolvedValue({})
        },
        user: {
            findUnique: vi.fn().mockResolvedValue({ id: 'user_123', email: 'test@example.com', paymentTotals: [] }),
            update: vi.fn().mockResolvedValue({ id: 'user_123', email: 'test@example.com', paymentTotals: [] })
        },
        userPaymentTotal: {
            upsert: vi.fn().mockResolvedValue({ amountMinor: 1000 }),
            findUnique: vi.fn().mockResolvedValue({ amountMinor: 1000 }),
            update: vi.fn().mockResolvedValue({})
        },
        patronGrant: {
            create: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        $transaction: vi.fn(async (fn) => await fn(mockPrisma))
    };

    ctx = {
        prisma: mockPrisma,
        actor: { type: 'system', reason: 'test' },
        now: () => new Date(),
        db: {
            read: mockPrisma,
            writeTransaction: async (fn: any) => await mockPrisma.$transaction(fn)
        }
    };
  });

  it('should acquire lock and process event', async () => {
    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.stripeEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'evt_123', status: WebhookEventStatus.PROCESSING })
    }));
    expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_123' },
      data: expect.objectContaining({ status: WebhookEventStatus.PROCESSED })
    }));
  });

  it('should handle duplicate events (already processed)', async () => {
    // Simulate P2002 error
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test'
    });
    mockPrisma.stripeEvent.create.mockRejectedValueOnce(error);

    // Simulate no updateMany match (meaning it's not stale/failed)
    mockPrisma.stripeEvent.updateMany.mockResolvedValueOnce({ count: 0 });

    // Simulate finding the PROCESSED event
    mockPrisma.stripeEvent.findUnique.mockResolvedValueOnce({ id: 'evt_123', status: WebhookEventStatus.PROCESSED });

    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(true);
    expect(mockPrisma.stripeEvent.update).not.toHaveBeenCalled(); // Should not re-process
  });
});
