import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStripeWebhook } from '@/lib/modules/payments/application/handle-stripe-webhook.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { PaymentStatus, WebhookEventStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { handleDispute } from '@/lib/modules/payments/application/handle-dispute.use-case';

const mockConstructEvent = vi.fn();

// Mocking Stripe construction and webhooks
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        webhooks: {
          constructEvent: mockConstructEvent,
        },
      };
    }),
  };
});

vi.mock('@/lib/modules/payments/application/fulfill-payment.use-case', () => ({
  fulfillPayment: vi.fn().mockResolvedValue({ ok: true, data: { isFirstFulfillment: true } }),
}));

vi.mock('@/lib/modules/payments/application/handle-refund.use-case', () => ({
  handleRefund: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/modules/payments/application/handle-dispute.use-case', () => ({
  handleDispute: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/logger');
vi.mock('@/lib/observability', () => ({
  startTimer: vi.fn().mockReturnValue(Date.now()),
  recordDurationMetric: vi.fn(),
  recordAlert: vi.fn(),
  recordMetric: vi.fn(),
}));

describe('Stripe Webhook Safety & Idempotency', () => {
  let mockPrisma: any;
  let ctx: any;
  let stripeMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      stripeEvent: {
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      payment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    ctx = createAppContext({
      actor: { type: 'system', reason: 'stripe-webhook' },
      prisma: mockPrisma,
      requestId: 'test-req',
    });

    stripeMock = new Stripe('key', {} as any);
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test';
  });

  const createMockEvent = (id: string, type: string, object: any): Stripe.Event => ({
    id,
    type,
    data: { object },
    created: Date.now(),
    livemode: false,
    object: 'event',
    api_version: '2024-12-18.acacia',
    pending_webhooks: 0,
    request: null,
  } as any);

  it('handles duplicate success event gracefully (ALREADY_PROCESSED)', async () => {
    const event = createMockEvent('evt_1', 'payment_intent.succeeded', { id: 'pi_1', metadata: {} });
    mockConstructEvent.mockReturnValue(event);

    // Simulate event already exists and is PROCESSED
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
    mockPrisma.stripeEvent.create.mockRejectedValue(error); // Unique constraint fail
    mockPrisma.stripeEvent.updateMany.mockResolvedValue({ count: 0 }); // No FAILED or STALE found
    mockPrisma.stripeEvent.findUnique.mockResolvedValue({ id: 'evt_1', status: WebhookEventStatus.PROCESSED });

    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(true);
    expect(fulfillPayment).not.toHaveBeenCalled();
    expect(mockPrisma.stripeEvent.update).not.toHaveBeenCalled(); // No release needed for already processed
  });

  it('asks Stripe to retry concurrent duplicate events (CONFLICT)', async () => {
    const event = createMockEvent('evt_1', 'payment_intent.succeeded', { id: 'pi_1', metadata: {} });
    mockConstructEvent.mockReturnValue(event);

    // Simulate event already exists and is PROCESSING (and not stale)
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
    mockPrisma.stripeEvent.create.mockRejectedValue(error);
    mockPrisma.stripeEvent.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.stripeEvent.findUnique.mockResolvedValue({ id: 'evt_1', status: WebhookEventStatus.PROCESSING, updatedAt: new Date() });

    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(false); // Return non-2xx to Stripe so a stuck PROCESSING lock is retried
    expect(fulfillPayment).not.toHaveBeenCalled();
  });

  it('re-acquires lock for FAILED event and processes it', async () => {
    const event = createMockEvent('evt_1', 'payment_intent.succeeded', { id: 'pi_1', metadata: { paymentId: 'pay_1' } });
    mockConstructEvent.mockReturnValue(event);

    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
    mockPrisma.stripeEvent.create.mockRejectedValue(error);
    mockPrisma.stripeEvent.updateMany.mockResolvedValue({ count: 1 }); // Found FAILED event

    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(true);
    expect(fulfillPayment).toHaveBeenCalled();
    expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_1' },
      data: expect.objectContaining({ status: WebhookEventStatus.PROCESSED })
    }));
  });

  it('successfully routes charge.refunded to handleRefund', async () => {
    const event = createMockEvent('evt_refund', 'charge.refunded', {
        id: 'ch_1',
        metadata: { paymentId: 'pay_1' },
        payment_intent: 'pi_1',
        amount_refunded: 1000
    });
    mockConstructEvent.mockReturnValue(event);
    mockPrisma.stripeEvent.create.mockResolvedValue({});

    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(true);
    expect(handleRefund).toHaveBeenCalledWith(expect.objectContaining({
        paymentId: 'pay_1',
        stripeIntentId: 'pi_1',
        reportedRefundedMinor: 1000
    }), ctx);
  });

  it('successfully routes charge.dispute.created to handleDispute', async () => {
    const event = createMockEvent('evt_dispute', 'charge.dispute.created', {
        id: 'dp_1',
        payment_intent: 'pi_1',
        status: 'needs_response'
    });
    mockConstructEvent.mockReturnValue(event);
    mockPrisma.stripeEvent.create.mockResolvedValue({});

    const result = await handleStripeWebhook({ body: '{}', signature: 'sig' }, ctx);

    expect(result.ok).toBe(true);
    expect(handleDispute).toHaveBeenCalledWith(expect.objectContaining({
        stripeIntentId: 'pi_1',
        disputeId: 'dp_1',
        status: 'needs_response'
    }), ctx);
  });
});
