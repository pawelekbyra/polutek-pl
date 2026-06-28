import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRefund } from '@/lib/modules/payments/application/handle-refund.use-case';
import { AppContext } from '@/lib/modules/shared/app-context';
import { Actor } from '@/lib/modules/shared/actor';
import { PaymentStatus } from '@prisma/client';
import { revokePatron, recalculatePatronStatus } from '@/lib/modules/patron';
import { UserAccessService } from '@/lib/services/user-access.service';

vi.mock('@/lib/modules/patron', () => ({
  revokePatron: vi.fn(),
  recalculatePatronStatus: vi.fn(),
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: {
    syncClerkAccess: vi.fn(),
  },
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
    expect(UserAccessService.syncClerkAccess).toHaveBeenCalledWith(userId, false, 0);
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
    expect(UserAccessService.syncClerkAccess).toHaveBeenCalledWith(userId, true, 500);
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
    expect(UserAccessService.syncClerkAccess).not.toHaveBeenCalled();
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
    expect(UserAccessService.syncClerkAccess).not.toHaveBeenCalled();
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
    expect(UserAccessService.syncClerkAccess).not.toHaveBeenCalled();
  });
});
