import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '@/lib/services/payment.service';
import { prisma } from '@/lib/prisma';
import { PaymentStatus, PatronGrantSource } from '@prisma/client';
import { EmailService } from '@/lib/services/email.service';
import { UserAccessService } from '@/lib/services/user-access.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb(prisma)),
    payment: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userPaymentTotal: {
      upsert: vi.fn(),
    },
    patronGrant: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    }
  },
}));

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendDonationThankYouEmail: vi.fn().mockResolvedValue({}),
    sendBecomePatronEmail: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: {
    syncClerkAccess: vi.fn().mockResolvedValue({}),
    recalculateUserPatronStatus: vi.fn(),
  },
}));

describe('PaymentService.fulfillPayment lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockIntent = {
    id: 'pi_123',
    amount: 10000,
    currency: 'pln',
    metadata: {
      paymentId: 'pay_123',
      userId: 'user_123',
    },
  } as any;

  it('successfully transitions PENDING -> SUCCEEDED and grants Patron status', async () => {
    // 1. Setup mocks
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_123',
      amountMinor: 10000,
      currency: 'PLN',
      status: 'PENDING'
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      isPatron: false,
      paymentTotals: []
    } as any);
    vi.mocked(prisma.userPaymentTotal.upsert).mockResolvedValue({ amountMinor: 10000 } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        isPatron: true,
        paymentTotals: [{ currency: 'PLN', amountMinor: 10000 }]
    } as any);

    // 2. Execute
    await (PaymentService as any).fulfillPayment(mockIntent);

    // 3. Verify
    expect(prisma.payment.updateMany).toHaveBeenCalled();
    expect(prisma.userPaymentTotal.upsert).toHaveBeenCalled();
    expect(prisma.patronGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_123',
        source: PatronGrantSource.PAYMENT,
      })
    });
    expect(UserAccessService.syncClerkAccess).toHaveBeenCalled();
    expect(EmailService.sendDonationThankYouEmail).toHaveBeenCalled();
    expect(EmailService.sendBecomePatronEmail).toHaveBeenCalled();
  });

  it('is idempotent and returns early if payment is already fulfilled', async () => {
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 0 });

    await (PaymentService as any).fulfillPayment(mockIntent);

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates UserPaymentTotal but does not grant Patron if below threshold', async () => {
    const smallIntent = { ...mockIntent, amount: 500 }; // 5 PLN < 20 PLN threshold

    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_123',
      amountMinor: 500,
      currency: 'PLN',
      status: 'PENDING'
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_123',
      email: 'test@example.com',
      isPatron: false,
      paymentTotals: []
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user_123',
        isPatron: false,
        paymentTotals: [{ currency: 'PLN', amountMinor: 500 }]
    } as any);

    await (PaymentService as any).fulfillPayment(smallIntent);

    expect(prisma.patronGrant.create).not.toHaveBeenCalled();
    expect(EmailService.sendDonationThankYouEmail).toHaveBeenCalled();
    expect(EmailService.sendBecomePatronEmail).not.toHaveBeenCalled();
  });
});
