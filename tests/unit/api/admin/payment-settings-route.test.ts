import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/admin/payment-settings/route';
import { getPaymentSettings, updatePaymentSettings } from '@/lib/modules/payments';
import { requireAdminForApi } from '@/lib/auth-utils';

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/modules/payments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/modules/payments')>('@/lib/modules/payments');
  return {
    ...actual,
    getPaymentSettings: vi.fn(),
    updatePaymentSettings: vi.fn(),
  };
});

function makeGetRequest() {
  return new NextRequest('http://localhost/api/admin/payment-settings');
}

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/payment-settings', {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('/api/admin/payment-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminForApi).mockResolvedValue({
      adminUserId: 'admin_1',
      response: null,
    } as any);
  });

  describe('GET', () => {
    it('returns { limits } from the use-case on success', async () => {
      vi.mocked(getPaymentSettings).mockResolvedValue({ ok: true, data: { PLN: {} } } as any);

      const res = await GET(makeGetRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ limits: { PLN: {} } });
    });

    it('maps a use-case failure to its statusCode', async () => {
      vi.mocked(getPaymentSettings).mockResolvedValue({
        ok: false,
        error: { message: 'nope', statusCode: 403 },
      } as any);

      const res = await GET(makeGetRequest());

      expect(res.status).toBe(403);
    });

    it('short-circuits with the requireAdminForApi response when not an admin', async () => {
      vi.mocked(requireAdminForApi).mockResolvedValue({
        adminUserId: '',
        response: new Response('Unauthorized', { status: 401 }),
      } as any);

      const res = await GET(makeGetRequest());

      expect(res.status).toBe(401);
      expect(getPaymentSettings).not.toHaveBeenCalled();
    });
  });

  describe('PATCH', () => {
    const validBody = {
      limits: [{ currency: 'PLN', minAmount: 10, patronThreshold: 50, patronBoxMin: 20 }],
    };

    it('validates, forwards limits to updatePaymentSettings, and returns { limits } on success', async () => {
      vi.mocked(updatePaymentSettings).mockResolvedValue({ ok: true, data: { PLN: {} } } as any);

      const res = await PATCH(makePatchRequest(validBody));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ limits: { PLN: {} } });
      expect(updatePaymentSettings).toHaveBeenCalledWith({ limits: validBody.limits }, expect.anything());
    });

    it('returns 400 for malformed JSON without calling the use-case', async () => {
      const res = await PATCH(makePatchRequest('not json'));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ error: 'Invalid JSON' });
      expect(updatePaymentSettings).not.toHaveBeenCalled();
    });

    it('returns 400 with validation details for a schema-invalid body', async () => {
      const res = await PATCH(makePatchRequest({ limits: [{ currency: 'PLN', minAmount: -5 }] }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid data');
      expect(body.details).toBeDefined();
      expect(updatePaymentSettings).not.toHaveBeenCalled();
    });

    it('rejects an unsupported currency code', async () => {
      const res = await PATCH(makePatchRequest({ limits: [{ currency: 'XXX', minAmount: 10 }] }));

      expect(res.status).toBe(400);
      expect(updatePaymentSettings).not.toHaveBeenCalled();
    });

    it('maps a use-case failure to its statusCode', async () => {
      vi.mocked(updatePaymentSettings).mockResolvedValue({
        ok: false,
        error: { message: 'Forbidden: Cannot manage payment settings', statusCode: 400 },
      } as any);

      const res = await PATCH(makePatchRequest(validBody));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ error: 'Forbidden: Cannot manage payment settings' });
    });

    it('short-circuits with the requireAdminForApi response when not an admin', async () => {
      vi.mocked(requireAdminForApi).mockResolvedValue({
        adminUserId: '',
        response: new Response('Unauthorized', { status: 401 }),
      } as any);

      const res = await PATCH(makePatchRequest(validBody));

      expect(res.status).toBe(401);
      expect(updatePaymentSettings).not.toHaveBeenCalled();
    });
  });
});
