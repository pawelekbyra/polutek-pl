import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/checkout/create-intent/route';
import { createCheckoutIntent } from '@/lib/modules/payments';
import { getOrCreateCurrentUser, recordTermsAcceptance } from '@/lib/modules/users';
import { LEGAL_DOCUMENTS_VERSION } from '@/lib/legal/version';
import { auth } from '@/lib/auth/server';
import { ok } from '@/lib/modules/shared/result';
import { PaymentStatus } from '@prisma/client';

vi.mock('@/lib/auth/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/modules/payments', () => ({
  createCheckoutIntent: vi.fn(),
}));

vi.mock('@/lib/modules/users', () => ({
  getOrCreateCurrentUser: vi.fn(),
  recordTermsAcceptance: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/payments/currency-settings', () => ({
  validatePaymentAmountMinorAsync: vi.fn().mockResolvedValue(null),
}));

describe('Checkout API Route Response Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns status and terminal in JSON response', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue({ id: 'user_123' } as any);
    vi.mocked(createCheckoutIntent).mockResolvedValue(ok({
      paymentId: 'pay_123',
      clientSecret: 'secret_123',
      status: PaymentStatus.PENDING,
      terminal: false,
    }));

    const req = new NextRequest('http://localhost/api/checkout/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amountMinor: 1000, currency: 'PLN', title: 'Test Payment' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      paymentId: 'pay_123',
      clientSecret: 'secret_123',
      status: PaymentStatus.PENDING,
      terminal: false,
    }));
  });

  it('returns status and terminal when payment is already terminal', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue({ id: 'user_123' } as any);
    vi.mocked(createCheckoutIntent).mockResolvedValue(ok({
      paymentId: 'pay_already_succeeded',
      clientSecret: null,
      status: PaymentStatus.SUCCEEDED,
      terminal: true,
    }));

    const req = new NextRequest('http://localhost/api/checkout/create-intent', {
      method: 'POST',
      body: JSON.stringify({
        amountMinor: 1000,
        currency: 'PLN',
        title: 'Test Payment',
        requestId: '550e8400-e29b-41d4-a716-446655440000'
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      paymentId: 'pay_already_succeeded',
      clientSecret: null,
      status: PaymentStatus.SUCCEEDED,
      terminal: true,
    });
  });

  it('records the Terms version the payer ticked, and never lets that block the tip', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue({ id: 'user_123' } as any);
    vi.mocked(createCheckoutIntent).mockResolvedValue(ok({ paymentId: 'p', clientSecret: 's', status: PaymentStatus.PENDING, terminal: false }));
    vi.mocked(recordTermsAcceptance).mockRejectedValueOnce(new Error('db down'));

    const res = await POST(new NextRequest('http://localhost/api/checkout/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amountMinor: 1000, currency: 'PLN', acceptedTermsVersion: LEGAL_DOCUMENTS_VERSION }),
    }));

    expect(res.status).toBe(200);
    expect(recordTermsAcceptance).toHaveBeenCalledWith(expect.anything(), 'user_123', LEGAL_DOCUMENTS_VERSION);
    expect(createCheckoutIntent).toHaveBeenCalled();
  });

  it('records nothing when the client sent no Terms version', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue({ id: 'user_123' } as any);
    vi.mocked(createCheckoutIntent).mockResolvedValue(ok({ paymentId: 'p', clientSecret: 's', status: PaymentStatus.PENDING, terminal: false }));

    await POST(new NextRequest('http://localhost/api/checkout/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amountMinor: 1000, currency: 'PLN' }),
    }));

    expect(recordTermsAcceptance).not.toHaveBeenCalled();
  });
});