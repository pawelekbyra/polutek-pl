import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/payments/[id]/refund/route';
import { adminRefund } from '@/lib/modules/payments';
import { requireAdminForApi } from '@/lib/auth-utils';

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/modules/payments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/modules/payments')>('@/lib/modules/payments');
  return {
    ...actual,
    adminRefund: vi.fn(),
  };
});

function makeRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/payments/pay_1/refund', {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function callRoute(req: NextRequest, id = 'pay_1') {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe('POST /api/admin/payments/[id]/refund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin_1',
      response: null,
    } as any);
  });

  it('performs a full refund with an empty body and returns the use-case result', async () => {
    vi.mocked(adminRefund).mockResolvedValue({
      ok: true,
      data: { stripeRefundId: 're_1', amountMinor: 1000, status: 'succeeded' },
    } as any);

    const res = await callRoute(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ stripeRefundId: 're_1', amountMinor: 1000, status: 'succeeded' });
    expect(adminRefund).toHaveBeenCalledWith(
      { paymentId: 'pay_1', amountMinor: undefined, reason: undefined },
      expect.anything(),
    );
  });

  it('passes amountMinor and reason from the request body through to adminRefund', async () => {
    vi.mocked(adminRefund).mockResolvedValue({
      ok: true,
      data: { stripeRefundId: 're_2', amountMinor: 300, status: 'succeeded' },
    } as any);

    await callRoute(makeRequest({ amountMinor: 300, reason: 'duplicate charge' }));

    expect(adminRefund).toHaveBeenCalledWith(
      { paymentId: 'pay_1', amountMinor: 300, reason: 'duplicate charge' },
      expect.anything(),
    );
  });

  it('resolves the [id] route param into paymentId', async () => {
    vi.mocked(adminRefund).mockResolvedValue({ ok: true, data: {} } as any);

    await callRoute(makeRequest(), 'pay_other');

    expect(adminRefund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_other' }),
      expect.anything(),
    );
  });

  it('maps a use-case failure to its statusCode with an { error } body', async () => {
    vi.mocked(adminRefund).mockResolvedValue({
      ok: false,
      error: { message: 'Payment pay_1 not found', statusCode: 404 },
    } as any);

    const res = await callRoute(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Payment pay_1 not found' });
  });

  it('falls back to a 400 status when the use-case error carries no statusCode', async () => {
    vi.mocked(adminRefund).mockResolvedValue({
      ok: false,
      error: { message: 'Something went wrong' },
    } as any);

    const res = await callRoute(makeRequest());

    expect(res.status).toBe(400);
  });

  it('short-circuits with the requireAdminForApi response when not an admin', async () => {
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: '',
      response: new Response('Unauthorized', { status: 401 }),
    } as any);

    const res = await callRoute(makeRequest());

    expect(res.status).toBe(401);
    expect(adminRefund).not.toHaveBeenCalled();
  });
});
