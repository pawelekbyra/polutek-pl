import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookEventStatus } from '@prisma/client';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users';
import { acquireClerkEventLock } from '@/lib/webhooks/clerk-idempotency';
import { POST } from '@/app/api/webhooks/clerk/route';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn(),
}));

vi.mock('@/lib/modules/users', () => ({
  SyncUserFromWebhookUseCase: {
    execute: vi.fn(),
    softDelete: vi.fn(),
    updatePassword: vi.fn(),
    finalizeEvent: vi.fn(),
  },
}));

vi.mock('@/lib/webhooks/clerk-idempotency', () => ({
  acquireClerkEventLock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        }
    }
}));

const baseHeaders = new Map([
  ['svix-id', 'evt_1'],
  ['svix-timestamp', '1760000000'],
  ['svix-signature', 'sig_1'],
]);

function mockHeaders(values = baseHeaders) {
  vi.mocked(headers).mockReturnValue({
    get: (key: string) => values.get(key) ?? null,
  } as never);
}

function mockVerifiedEvent(event: unknown) {
  vi.mocked(Webhook).mockImplementation(function () {
    return { verify: vi.fn().mockReturnValue(event) };
  } as never);
}

function requestFor(payload: unknown) {
  return new Request('http://localhost/api/webhooks/clerk', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/webhooks/clerk route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_clerk';
    mockHeaders();
    vi.mocked(acquireClerkEventLock).mockResolvedValue({ success: true, acquired: true, duplicate: false, processing: false });
  });

  it('rejects requests with missing Svix headers before signature verification', async () => {
    mockHeaders(new Map([['svix-id', 'evt_missing_headers']]));

    const response = await POST(requestFor({ type: 'user.created' }));

    expect(response.status).toBe(400);
    expect(Webhook).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures without writing webhook state', async () => {
    vi.mocked(Webhook).mockImplementation(function () {
      return {
        verify: vi.fn().mockImplementation(() => {
          throw new Error('invalid signature');
        }),
      };
    } as never);

    const response = await POST(requestFor({ type: 'user.created' }));

    expect(response.status).toBe(400);
    expect(acquireClerkEventLock).not.toHaveBeenCalled();
  });

  it('syncs user.created fixture data and sends a welcome email', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: 'user_1',
        email_addresses: [{ email_address: 'new@example.com' }],
        first_name: 'Anna',
        last_name: 'Nowak',
        username: 'anna-nowak',
        image_url: 'https://example.com/avatar.png',
        unsafe_metadata: { referrerId: 'ref_1' },
        public_metadata: { preferredLanguage: 'en' },
      },
    };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(SyncUserFromWebhookUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
          id: 'user_1',
          email: 'new@example.com',
          name: 'Anna Nowak',
          imageUrl: 'https://example.com/avatar.png',
          language: 'en',
          username: 'anna-nowak',
      }),
      'user.created'
    );
    expect(SyncUserFromWebhookUseCase.finalizeEvent).toHaveBeenCalledWith(
        expect.anything(),
        'evt_1',
        WebhookEventStatus.PROCESSED
    );
  });

  it('syncs user.updated fixture data', async () => {
    const payload = {
      type: 'user.updated',
      data: {
        id: 'user_1',
        email_addresses: [{ email_address: 'updated@example.com' }],
        first_name: 'Jan',
        last_name: null,
        username: 'jan',
        image_url: null,
        public_metadata: { language: 'pl' },
      },
    };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(SyncUserFromWebhookUseCase.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            id: 'user_1',
            email: 'updated@example.com',
            name: 'Jan',
            language: 'pl',
            username: 'jan'
        }),
        'user.updated'
    );
  });

  it('soft-deletes user.deleted fixture data', async () => {
    const payload = { type: 'user.deleted', data: { id: 'user_1' } };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(SyncUserFromWebhookUseCase.softDelete).toHaveBeenCalledWith(expect.anything(), 'user_1');
  });

  it('short-circuits processed duplicate events without running user side effects', async () => {
    vi.mocked(acquireClerkEventLock).mockResolvedValue({ success: true, acquired: false, duplicate: true, processing: false });

    const payload = { type: 'user.created', data: { id: 'user_1' } };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, duplicate: true, processing: false });
    expect(SyncUserFromWebhookUseCase.execute).not.toHaveBeenCalled();
  });

  it('short-circuits fresh in-flight events so parallel deliveries are idempotent', async () => {
    vi.mocked(acquireClerkEventLock).mockResolvedValue({ success: true, acquired: false, duplicate: false, processing: true });

    const payload = { type: 'user.updated', data: { id: 'user_1' } };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, duplicate: false, processing: true });
    expect(SyncUserFromWebhookUseCase.execute).not.toHaveBeenCalled();
  });
});
