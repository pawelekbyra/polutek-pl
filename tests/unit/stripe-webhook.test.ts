import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from '@/lib/services/payment.service';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { WebhookEventStatus, Prisma } from '@prisma/client';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { recalculatePatronStatus } from '@/lib/modules/patron';
import { syncClerkAccess } from '@/lib/modules/users/application/sync-clerk-access';

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
    userPaymentTotal: {
        findUnique: vi.fn(),
        update: vi.fn(),
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

vi.mock('@/lib/modules/payments/application/fulfill-payment.use-case', () => ({
  fulfillPayment: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/modules/patron', () => ({
  recalculatePatronStatus: vi.fn().mockResolvedValue({ ok: true, data: { isPatron: true, normalizedTotal: 100 } }),
}));

vi.mock('@/lib/modules/users/application/sync-clerk-access', () => ({
  syncClerkAccess: vi.fn().mockResolvedValue(undefined),
}));

// LEGACY COVERAGE ONLY:
// PaymentService is a deprecated compatibility facade. The current runtime Stripe
// webhook route uses app/api/webhooks/stripe/route.ts -> handleStripeWebhook.
// Keep these tests only as legacy idempotency/status coverage; do not treat them
// as proof that the active modular webhook route is fully covered.
describe('Stripe Webhook Idempotency and Status (legacy PaymentService)', () => {
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

    expect(fulfillPayment).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.update).not.toHaveBeenCalled();
  });

  it('marks StripeEvent as FAILED when processing throws', async () => {
      const event = { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } } as any;
      mockConstructEvent.mockReturnValue(event);
      vi.mocked(prisma.stripeEvent.create).mockResolvedValue({} as any);
      vi.mocked(fulfillPayment).mockRejectedValue(new Error('fulfillment failed'));

      await expect(PaymentService.handleWebhook(body, sig)).rejects.toThrow('fulfillment failed');

      expect(prisma.stripeEvent.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'evt_1' },
          data: expect.objectContaining({ status: WebhookEventStatus.FAILED, error: 'fulfillment failed' })
      }));
  });

  it('handles partial refunds with PatronGrant-backed recalculation instead of User.isPatron cache', async () => {
      const event = {
        id: 'evt_refund_partial',
        type: 'charge.refunded',
        data: {
          object: {
            amount_refunded: 500,
            metadata: { paymentId: 'pay_1' },
            payment_intent: 'pi_1',
          },
        },
      } as any;
      mockConstructEvent.mockReturnValue(event);
      vi.mocked(prisma.stripeEvent.create).mockResolvedValue({} as any);
      vi.mocked(prisma.payment.findUnique).mockResolvedValue({
        id: 'pay_1',
        userId: 'user_1',
        amountMinor: 1000,
        refundedAmountMinor: 0,
        currency: 'PLN',
        status: 'SUCCEEDED',
      } as any);
      vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked((prisma as any).userPaymentTotal.findUnique).mockResolvedValue({ amountMinor: 1000 });
      vi.mocked((prisma as any).userPaymentTotal.update).mockResolvedValue({} as any);
      vi.mocked(recalculatePatronStatus).mockResolvedValue({ ok: true, data: { isPatron: false, normalizedTotal: 5 } } as any);

      await PaymentService.handleWebhook(body, sig);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(recalculatePatronStatus).toHaveBeenCalledWith('user_1', expect.any(Object), prisma);
      expect(syncClerkAccess).toHaveBeenCalledWith('user_1', false, 5);
  });

});
