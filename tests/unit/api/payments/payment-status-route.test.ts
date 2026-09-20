import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GET } from '@/app/api/payments/[paymentId]/route';
import { getOwnedPaymentStatus } from '@/lib/modules/payments';
import { PaymentError } from '@/lib/modules/payments/domain/payment.errors';
import { PaymentStatus } from '@prisma/client';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/modules/payments', () => ({
  getOwnedPaymentStatus: vi.fn(),
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/payments/pay_1');
}

function callRoute(req: NextRequest, paymentId = 'pay_1') {
  return GET(req, { params: Promise.resolve({ paymentId }) });
}

describe('GET /api/payments/[paymentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without hitting the use-case when the caller is not signed in', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const res = await callRoute(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(getOwnedPaymentStatus).not.toHaveBeenCalled();
  });

  it('resolves the [paymentId] route param and scopes the lookup to the signed-in userId', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
    vi.mocked(getOwnedPaymentStatus).mockResolvedValue({
      ok: true,
      data: { id: 'pay_1', status: PaymentStatus.SUCCEEDED },
    } as any);

    await callRoute(makeRequest(), 'pay_1');

    expect(getOwnedPaymentStatus).toHaveBeenCalledWith(
      { paymentId: 'pay_1', userId: 'user_1' },
      expect.anything(),
    );
  });

  it('returns 200 with the payment status data on success', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
    vi.mocked(getOwnedPaymentStatus).mockResolvedValue({
      ok: true,
      data: { id: 'pay_1', status: PaymentStatus.PENDING },
    } as any);

    const res = await callRoute(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: 'pay_1', status: PaymentStatus.PENDING });
  });

  it('returns 404 when the use-case finds no owned payment (ownership boundary)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
    vi.mocked(getOwnedPaymentStatus).mockResolvedValue({ ok: true, data: null } as any);

    const res = await callRoute(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Not found' });
  });

  it('maps a use-case PaymentError through handleApiError using its own statusCode', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
    vi.mocked(getOwnedPaymentStatus).mockResolvedValue({
      ok: false,
      error: new PaymentError('Stripe lookup failed', 'PAYMENT_PROVIDER_ERROR', 502),
    } as any);

    const res = await callRoute(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: 'PAYMENT_PROVIDER_ERROR', message: 'Stripe lookup failed' });
  });

  it('returns a 500 if the use-case throws unexpectedly', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as any);
    vi.mocked(getOwnedPaymentStatus).mockRejectedValue(new Error('unexpected'));

    const res = await callRoute(makeRequest());

    expect(res.status).toBe(500);
  });
});
