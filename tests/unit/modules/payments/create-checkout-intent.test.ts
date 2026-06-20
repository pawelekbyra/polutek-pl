import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckoutIntent } from '@/lib/modules/payments/application/create-checkout-intent.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentStatus } from '@prisma/client';

const mockRepo = {
  findUser: vi.fn(),
  findPaymentByRequestId: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  updateStripeCustomerId: vi.fn(),
};

vi.mock('@/lib/modules/payments/infrastructure/payment.repository', () => ({
  PaymentRepository: function() { return mockRepo; },
}));

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
    create: vi.fn(),
    retrieve: vi.fn(),
  },
};

vi.mock('stripe', () => ({
  default: function() { return mockStripe; },
}));

describe('createCheckoutIntent use case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
    mockRepo.findUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com', stripeCustomerId: 'cus_123' });
    mockRepo.findPaymentByRequestId.mockResolvedValue(null);
    mockRepo.createPayment.mockResolvedValue({ id: 'pay-1' });
    mockRepo.updatePayment.mockResolvedValue({});
    mockRepo.updateStripeCustomerId.mockResolvedValue({});
    mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_123', client_secret: 'secret_123' });
    mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123', client_secret: 'secret_123' });
  });

  it('requires user or admin actor', async () => {
    const actor: Actor = { type: 'guest' };
    const ctx = createAppContext({ actor, prisma: {} as any });
    const result = await createCheckoutIntent({ userId: 'user-1', amountMinor: 1000, currency: 'PLN', title: 'Test' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PAYMENT_REQUEST');
  });

  it('successfully creates checkout intent for user actor', async () => {
    const actor: Actor = { type: 'user', userId: 'user-1', isPatron: false };
    const ctx = createAppContext({ actor, prisma: {} as any });
    const result = await createCheckoutIntent({ userId: 'user-1', amountMinor: 1000, currency: 'PLN', title: 'Test' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentId).toBe('pay-1');
      expect(result.data.clientSecret).toBe('secret_123');
    }
  });

  it('deduplicates a pending checkout request without creating another payment intent', async () => {
    const actor: Actor = { type: 'user', userId: 'user-1', isPatron: false };
    const ctx = createAppContext({ actor, prisma: {} as any });
    mockRepo.findPaymentByRequestId.mockResolvedValueOnce({ id: 'pay-existing', status: PaymentStatus.PENDING, stripeIntentId: 'pi_existing' });
    mockStripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_existing', client_secret: 'secret_existing' });

    const result = await createCheckoutIntent({
      userId: 'user-1',
      amountMinor: 1000,
      currency: 'PLN',
      title: 'Test',
      requestId: '00000000-0000-0000-0000-000000000001',
    }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentId).toBe('pay-existing');
      expect(result.data.clientSecret).toBe('secret_existing');
    }
    expect(mockRepo.createPayment).not.toHaveBeenCalled();
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('returns a stable terminal response for a reused failed checkout request', async () => {
    const actor: Actor = { type: 'user', userId: 'user-1', isPatron: false };
    const ctx = createAppContext({ actor, prisma: {} as any });
    mockRepo.findPaymentByRequestId.mockResolvedValueOnce({ id: 'pay-failed', status: PaymentStatus.FAILED, stripeIntentId: 'pi_failed' });

    const result = await createCheckoutIntent({
      userId: 'user-1',
      amountMinor: 1000,
      currency: 'PLN',
      title: 'Test',
      requestId: '00000000-0000-0000-0000-000000000002',
    }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentId).toBe('pay-failed');
      expect(result.data.clientSecret).toBeNull();
      expect(result.data.status).toBe(PaymentStatus.FAILED);
    }
    expect(mockRepo.createPayment).not.toHaveBeenCalled();
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });
});
