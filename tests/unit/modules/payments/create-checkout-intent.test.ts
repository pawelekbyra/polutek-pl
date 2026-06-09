import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckoutIntent } from '@/lib/modules/payments/application/create-checkout-intent.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentStatus } from '@prisma/client';

const mockRepo = {
  findUser: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      stripeCustomerId: 'cus_123'
  }),
  findPendingPaymentByRequestId: vi.fn().mockResolvedValue(null),
  createPayment: vi.fn().mockResolvedValue({ id: 'pay-1' }),
  updatePayment: vi.fn().mockResolvedValue({}),
  updateStripeCustomerId: vi.fn().mockResolvedValue({}),
};

vi.mock('@/lib/modules/payments/infrastructure/payment.repository', () => {
  return {
    PaymentRepository: function() { return mockRepo; },
  };
});

vi.mock('@/lib/modules/channel', () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: 'creator-1' }),
  }
}));

const mockStripe = {
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_123' }),
  },
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'secret_123' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'secret_123' }),
  },
};

vi.mock('stripe', () => {
  return {
    default: function() { return mockStripe; },
  };
});

describe('createCheckoutIntent use case', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
  });

  it('requires user or admin actor', async () => {
    const actor: Actor = { type: 'guest' };
    const ctx = createAppContext({
        actor,
        prisma: {} as any,
    });
    const result = await createCheckoutIntent({
        userId: 'user-1',
        amountMinor: 1000,
        currency: 'PLN',
        title: 'Test'
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PAYMENT_REQUEST');
    }
  });

  it('successfully creates checkout intent for user actor', async () => {
    const actor: Actor = { type: 'user', userId: 'user-1', isPatron: false };
    const ctx = createAppContext({
        actor,
        prisma: {} as any,
    });
    const result = await createCheckoutIntent({
        userId: 'user-1',
        amountMinor: 1000,
        currency: 'PLN',
        title: 'Test'
    }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.data.paymentId).toBe('pay-1');
      expect(result.data.clientSecret).toBe('secret_123');
    }
  });
});
