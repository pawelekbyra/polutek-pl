import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@prisma/client';
import { GET } from '@/app/api/payments/[paymentId]/route';

const authMock = vi.fn();
const paymentFindFirst = vi.fn();
const patronGrantFindFirst = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

vi.mock('@/lib/modules/shared/app-context', () => ({
  createAppContext: vi.fn(() => ({
    db: {
      read: {
        payment: { findFirst: paymentFindFirst },
        patronGrant: { findFirst: patronGrantFindFirst },
      },
    },
  })),
}));

function params(paymentId: string) {
  return { params: Promise.resolve({ paymentId }) };
}

describe('GET /api/payments/[paymentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'clerk_user_1' });
    paymentFindFirst.mockResolvedValue({
      id: 'pay_1',
      status: PaymentStatus.PENDING,
      amountMinor: 1000,
      currency: 'PLN',
      refundedAmountMinor: 0,
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    patronGrantFindFirst.mockResolvedValue(null);
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const response = await GET({} as any, params('pay_1'));

    expect(response.status).toBe(401);
    expect(paymentFindFirst).not.toHaveBeenCalled();
  });

  it('queries payment ownership by authenticated Clerk-backed User.id', async () => {
    const response = await GET({} as any, params('pay_1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(paymentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pay_1', userId: 'clerk_user_1' },
    }));
    expect(body.uiStatus).toBe('PENDING_WEBHOOK');
  });

  it('returns 404 when payment does not belong to the user', async () => {
    paymentFindFirst.mockResolvedValueOnce(null);

    const response = await GET({} as any, params('other_payment'));

    expect(response.status).toBe(404);
    expect(patronGrantFindFirst).not.toHaveBeenCalled();
  });

  it('distinguishes succeeded with active grant from access sync pending', async () => {
    paymentFindFirst.mockResolvedValueOnce({
      id: 'pay_1',
      status: PaymentStatus.SUCCEEDED,
      amountMinor: 1000,
      currency: 'PLN',
      refundedAmountMinor: 0,
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    patronGrantFindFirst.mockResolvedValueOnce({ id: 'grant_1' });

    const synced = await GET({} as any, params('pay_1'));
    expect((await synced.json()).uiStatus).toBe('SUCCEEDED');

    paymentFindFirst.mockResolvedValueOnce({
      id: 'pay_1',
      status: PaymentStatus.SUCCEEDED,
      amountMinor: 1000,
      currency: 'PLN',
      refundedAmountMinor: 0,
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    patronGrantFindFirst.mockResolvedValueOnce(null);

    const pending = await GET({} as any, params('pay_1'));
    expect((await pending.json()).uiStatus).toBe('ACCESS_SYNC_PENDING');
  });

  it('maps failed and refunded/disputed terminal states', async () => {
    paymentFindFirst.mockResolvedValueOnce({
      id: 'pay_1',
      status: PaymentStatus.FAILED,
      amountMinor: 1000,
      currency: 'PLN',
      refundedAmountMinor: 0,
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    expect((await (await GET({} as any, params('pay_1'))).json()).uiStatus).toBe('FAILED_CANCELED');

    paymentFindFirst.mockResolvedValueOnce({
      id: 'pay_1',
      status: PaymentStatus.DISPUTED,
      amountMinor: 1000,
      currency: 'PLN',
      refundedAmountMinor: 0,
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    expect((await (await GET({} as any, params('pay_1'))).json()).uiStatus).toBe('REFUNDED_DISPUTED');
  });
});
