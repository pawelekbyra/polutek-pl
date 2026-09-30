import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentStatus } from '@prisma/client';
import { revokePatron, recalculatePatronStatus } from '@/lib/modules/patron';
import { recordAuditEvent } from '@/lib/modules/audit';
import { syncClerkAccess } from '@/lib/modules/users/application/sync-clerk-access';

vi.mock('@/lib/modules/patron', () => ({
  revokePatron: vi.fn(),
  recalculatePatronStatus: vi.fn(),
}));

vi.mock('@/lib/modules/users/application/sync-clerk-access', () => ({
  syncClerkAccess: vi.fn(),
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/observability', () => ({
  recordMetric: vi.fn(),
  recordAlert: vi.fn(),
}));

describe('handleRefund', () => {
  let ctx: AppContext;
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      payment: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      userPaymentTotal: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $executeRaw: vi.fn(),
    };

    ctx = {
      actor: { type: 'system', reason: 'test' } as Actor,
      db: {
        read: {} as any,
        writeTransaction: vi.fn((cb) => cb(mockTx)),
      },
      requestId: 'test-request-id',
      now: () => new Date(),
      prisma: {} as any,
    } as unknown as AppContext;
  });

  it('should perform full refund and revoke patron status in the same transaction', async () => {
    const paymentId = 'pay_123';
    const userId = 'user_123';
    const amountMinor = 1000;

    mockTx.payment.findUnique.mockResolvedValue({
      id: paymentId,
      userId,
      amountMinor,
      refundedAmountMinor: 0,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });

    mockTx.payment.updateMany.mockResolvedValue({ count: 1 });
    mockTx.userPaymentTotal.findUnique.mockResolvedValue({ amountMinor });

    (revokePatron as any).mockResolvedValue({
      ok: true,
      data: { userId, isPatron: false, normalizedTotal: 0 },
    });

    const result = await handleRefund({ paymentId, reportedRefundedMinor: amountMinor }, ctx);

    expect(result.ok).toBe(true);
    expect(ctx.db.writeTransaction).toHaveBeenCalled();
    expect(mockTx.$executeRaw).toHaveBeenCalled();
    expect(revokePatron).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        paymentId: paymentId,
        note: `Payment ${paymentId} fully refunded`
      }),
      ctx,
      mockTx // Critical: verify tx sharing
    );
    expect(syncClerkAccess).toHaveBeenCalledWith(userId, false, 0);
  });

  it('should perform partial refund and recalculate patron status in the same transaction', async () => {
    const paymentId = 'pay_123';
    const userId = 'user_123';
    const amountMinor = 1000;
    const refundMinor = 500;

    mockTx.payment.findUnique.mockResolvedValue({
      id: paymentId,
      userId,
      amountMinor,
      refundedAmountMinor: 0,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });

    mockTx.payment.updateMany.mockResolvedValue({ count: 1 });
    mockTx.userPaymentTotal.findUnique.mockResolvedValue({ amountMinor });

    (recalculatePatronStatus as any).mockResolvedValue({
      ok: true,
      data: { userId, isPatron: true, normalizedTotal: 500 },
    });

    const result = await handleRefund({ paymentId, reportedRefundedMinor: refundMinor }, ctx);

    expect(result.ok).toBe(true);
    expect(mockTx.$executeRaw).toHaveBeenCalled();
    expect(recalculatePatronStatus).toHaveBeenCalledWith(userId, ctx, mockTx);
    expect(syncClerkAccess).toHaveBeenCalledWith(userId, true, 500);
  });

  describe('refund attribution', () => {
    beforeEach(() => {
      mockTx.payment.findUnique.mockResolvedValue({
        id: 'pay_1', userId: 'u1', amountMinor: 1000, refundedAmountMinor: 0,
        currency: 'PLN', status: PaymentStatus.SUCCEEDED,
      });
      mockTx.payment.updateMany.mockResolvedValue({ count: 1 });
      (recalculatePatronStatus as any).mockResolvedValue({ ok: true, data: { isPatron: true, normalizedTotal: 500 } });
    });

    it('stores who/when/why and audits PAYMENT_REFUNDED on the admin path, in the same tx', async () => {
      await handleRefund({
        paymentId: 'pay_1',
        reportedRefundedMinor: 500,
        admin: { refundedById: 'admin_1', reason: 'duplicate', stripeRefundId: 're_1' },
      }, ctx);

      const data = mockTx.payment.updateMany.mock.calls[0][0].data;
      expect(data).toMatchObject({ refundedById: 'admin_1', refundReason: 'duplicate' });
      expect(data.refundedAt).toBeInstanceOf(Date);
      expect(recordAuditEvent).toHaveBeenCalledWith(
        ctx,
        expect.objectContaining({
          action: 'PAYMENT_REFUNDED',
          targetType: 'Payment',
          targetId: 'pay_1',
          metadata: expect.objectContaining({ deltaMinor: 500, stripeRefundId: 're_1' }),
        }),
        mockTx
      );
    });

    it('does not fabricate an admin actor for a webhook-reported refund', async () => {
      await handleRefund({ paymentId: 'pay_1', reportedRefundedMinor: 500 }, ctx);

      const data = mockTx.payment.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('refundedById');
      expect(data).not.toHaveProperty('refundedAt');
      expect(recordAuditEvent).not.toHaveBeenCalled();
    });
  });

  it('should be idempotent and not perform sync if no delta', async () => {
    const paymentId = 'pay_123';
    const userId = 'user_123';
    const amountMinor = 1000;

    mockTx.payment.findUnique.mockResolvedValue({
      id: paymentId,
      userId,
      amountMinor,
      refundedAmountMinor: amountMinor,
      currency: 'PLN',
      status: PaymentStatus.REFUNDED,
    });

    const result = await handleRefund({ paymentId, reportedRefundedMinor: amountMinor }, ctx);

    expect(result.ok).toBe(true);
    expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    expect(revokePatron).not.toHaveBeenCalled();
    expect(syncClerkAccess).not.toHaveBeenCalled();
  });

  it('should handle CAS conflict by not performing further actions', async () => {
    const paymentId = 'pay_123';
    const userId = 'user_123';
    const amountMinor = 1000;

    mockTx.payment.findUnique.mockResolvedValue({
      id: paymentId,
      userId,
      amountMinor,
      refundedAmountMinor: 0,
      currency: 'PLN',
      status: PaymentStatus.SUCCEEDED,
    });

    // Simulate CAS conflict
    mockTx.payment.updateMany.mockResolvedValue({ count: 0 });

    const result = await handleRefund({ paymentId, reportedRefundedMinor: amountMinor }, ctx);

    expect(result.ok).toBe(true);
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    expect(revokePatron).not.toHaveBeenCalled();
    expect(syncClerkAccess).not.toHaveBeenCalled();
  });

  it('should handle zero delta refund', async () => {
    const paymentId = 'pay_123';
    const userId = 'user_123';
    const amountMinor = 1000;

    mockTx.payment.findUnique.mockResolvedValue({
      id: paymentId,
      userId,
      amountMinor,
      refundedAmountMinor: 500,
      currency: 'PLN',
      status: PaymentStatus.PARTIALLY_REFUNDED,
    });

    const result = await handleRefund({ paymentId, reportedRefundedMinor: 500 }, ctx);

    expect(result.ok).toBe(true);
    expect(mockTx.payment.updateMany).not.toHaveBeenCalled();
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    expect(revokePatron).not.toHaveBeenCalled();
    expect(syncClerkAccess).not.toHaveBeenCalled();
  });
});
