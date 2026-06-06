import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from '@/lib/services/payment.service';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { WebhookEventStatus, Prisma } from '@prisma/client';
import { PaymentFulfillmentService } from '@/lib/services/payments/fulfillment.service';

const mockConstructEvent = vi.fn();

vi.mock('stripe', () => {
  return {
    default: function() {
        return {
            webhooks: {
                constructEvent: mockConstructEvent,
            },
        };
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeEvent: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    payment: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    patronGrant: {
        updateMany: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  },
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
        constructor(message: string, { code, clientVersion }: { code: string; clientVersion: string }) {
            super(message);
            this.code = code;
            this.clientVersion = clientVersion;
        }
        code: string;
        clientVersion: string;
    }
  }
}));

vi.mock('@/lib/services/payments/fulfillment.service', () => ({
  PaymentFulfillmentService: {
    fulfillPayment: vi.fn(),
  },
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: {
    syncClerkAccess: vi.fn().mockResolvedValue(undefined),
    recalculateUserPatronStatus: vi.fn().mockResolvedValue({ isPatron: true, normalizedTotal: 100 }),
  },
  normalizePaymentTotals: vi.fn().mockReturnValue(100),
}));

describe('Stripe Webhook Idempotency and Status', () => {
  const body = '{}';
  const sig = 'sig';
  const endpointSecret = 'whsec_test';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = endpointSecret;
    process.env.STRIPE_SECRET_KEY = 'sk_test';
  });

  it('short-circuits when event is already PROCESSED', async () => {
    const event = { id: 'evt_1', type: 'payment_intent.succeeded' } as any;
    mockConstructEvent.mockReturnValue(event);

    vi.mocked(prisma.stripeEvent.create).mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.4.1' }));

    vi.mocked(prisma.stripeEvent.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.stripeEvent.findUnique).mockResolvedValue({ id: 'evt_1', status: WebhookEventStatus.PROCESSED } as any);

    await PaymentService.handleWebhook(body, sig);

    expect(PaymentFulfillmentService.fulfillPayment).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.update).not.toHaveBeenCalled();
  });

  it('marks StripeEvent as FAILED when processing throws', async () => {
      const event = { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } } as any;
      mockConstructEvent.mockReturnValue(event);
      vi.mocked(prisma.stripeEvent.create).mockResolvedValue({} as any);
      vi.mocked(PaymentFulfillmentService.fulfillPayment).mockRejectedValue(new Error('fulfillment failed'));

      await expect(PaymentService.handleWebhook(body, sig)).rejects.toThrow('fulfillment failed');

      expect(prisma.stripeEvent.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'evt_1' },
          data: expect.objectContaining({ status: WebhookEventStatus.FAILED, error: 'fulfillment failed' })
      }));
  });
});
