import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';

const mockRepo = {
  findById: vi.fn(),
  findUserWithTotals: vi.fn(),
  fulfillPendingPaymentWithCAS: vi.fn(),
  incrementUserPaymentTotal: vi.fn(),
};

vi.mock('@/lib/modules/payments/infrastructure/payment.repository', () => ({
  PaymentRepository: function () {
    return mockRepo;
  },
}));

const mockGrantPatron = vi.fn();
vi.mock('@/lib/modules/patron', () => ({
  grantPatron: mockGrantPatron,
}));

vi.mock('@/lib/payments/currency-settings', () => ({
  getPaymentCurrencyLimits: vi.fn().mockResolvedValue({
    PLN: {
      currency: 'PLN',
      minAmountMinor: 1000,
      minAmount: 10,
      maxAmountMinor: 100000,
      maxAmount: 1000,
    },
  }),
}));

const mockSyncClerkAccess = vi.fn();
vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: {
    syncClerkAccess: mockSyncClerkAccess,
  },
}));

const mockSendBecomePatronEmail = vi.fn();
const mockSendDonationThankYouEmail = vi.fn();
vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendBecomePatronEmail: mockSendBecomePatronEmail,
    sendDonationThankYouEmail: mockSendDonationThankYouEmail,
  },
}));

vi.mock('@/lib/services/audit.service', () => ({
  writeAuditLog: vi.fn(),
}));

const ctx = {
  db: {
    writeTransaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({})),
  },
} as any;

const basePayment = {
  id: 'pay_1',
  userId: 'user_1',
  creatorId: 'creator_1',
  amountMinor: 1000,
  currency: 'PLN',
  status: PaymentStatus.PENDING,
  stripeIntentId: null,
  requestId: null,
  refundedAmountMinor: 0,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseUser = {
  id: 'user_1',
  email: 'user@example.com',
  language: 'pl',
  isPatron: false,
  paymentTotals: [],
};

describe('fulfillPayment Stripe intent recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.findById.mockResolvedValue(basePayment);
    mockRepo.findUserWithTotals.mockResolvedValue(baseUser);
    mockRepo.fulfillPendingPaymentWithCAS.mockResolvedValue(1);
    mockRepo.incrementUserPaymentTotal.mockResolvedValue({ amountMinor: 1000 });
    mockGrantPatron.mockResolvedValue({
      ok: true,
      data: {
        isPatron: true,
        normalizedTotal: [{ currency: 'PLN', amountMinor: 1000 }],
      },
    });
    mockSyncClerkAccess.mockResolvedValue(undefined);
    mockSendBecomePatronEmail.mockResolvedValue(undefined);
    mockSendDonationThankYouEmail.mockResolvedValue(undefined);
  });

  it('recovers missing local stripeIntentId during the fulfillment CAS update', async () => {
    const result = await fulfillPayment({
      paymentId: 'pay_1',
      stripeIntentId: 'pi_recovered',
      metadataUserId: 'user_1',
      amountMinor: 1000,
      currency: 'pln',
    }, ctx);

    expect(result.ok).toBe(true);
    expect(mockRepo.fulfillPendingPaymentWithCAS).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pay_1',
      currentStripeIntentId: null,
      stripeIntentId: 'pi_recovered',
      amountMinor: 1000,
      currency: 'PLN',
    }), expect.anything());
    expect(mockGrantPatron).toHaveBeenCalled();
    expect(mockSyncClerkAccess).toHaveBeenCalledWith('user_1', true, [{ currency: 'PLN', amountMinor: 1000 }]);
  });

  it('rejects fulfillment when an existing local stripeIntentId differs from the webhook intent id', async () => {
    mockRepo.findById.mockResolvedValue({
      ...basePayment,
      stripeIntentId: 'pi_existing',
    });

    const result = await fulfillPayment({
      paymentId: 'pay_1',
      stripeIntentId: 'pi_other',
      metadataUserId: 'user_1',
      amountMinor: 1000,
      currency: 'PLN',
    }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('PAYMENT_STRIPE_INTENT_MISMATCH');
    }
    expect(mockRepo.fulfillPendingPaymentWithCAS).not.toHaveBeenCalled();
    expect(mockGrantPatron).not.toHaveBeenCalled();
  });
});
