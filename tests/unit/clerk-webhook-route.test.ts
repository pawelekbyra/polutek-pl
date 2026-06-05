import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookEventStatus } from '@prisma/client';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user.service';
import { EmailService } from '@/lib/services/email.service';
import { POST } from '@/app/api/webhooks/clerk/route';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clerkEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/user.service', () => ({
  UserService: {
    syncUser: vi.fn(),
    softDeleteUser: vi.fn(),
  },
}));

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn(),
    sendAccountDeletedEmail: vi.fn(),
    sendPasswordChangedEmail: vi.fn(),
  },
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
    vi.mocked(prisma.clerkEvent.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.clerkEvent.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.clerkEvent.update).mockResolvedValue({} as never);
  });

  it('rejects requests with missing Svix headers before signature verification', async () => {
    mockHeaders(new Map([['svix-id', 'evt_missing_headers']]));

    const response = await POST(requestFor({ type: 'user.created' }));

    expect(response.status).toBe(400);
    expect(Webhook).not.toHaveBeenCalled();
    expect(prisma.clerkEvent.upsert).not.toHaveBeenCalled();
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
    expect(prisma.clerkEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.clerkEvent.upsert).not.toHaveBeenCalled();
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
    vi.mocked(UserService.syncUser).mockResolvedValue({ id: 'user_1' } as never);

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(UserService.syncUser).toHaveBeenCalledWith(
      'user_1',
      'new@example.com',
      'Anna Nowak',
      'https://example.com/avatar.png',
      'ref_1',
      'en',
      'anna-nowak',
    );
    expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith('new@example.com', 'Anna', 'en');
    expect(prisma.clerkEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_1' },
      create: expect.objectContaining({ status: WebhookEventStatus.PROCESSING }),
    }));
    expect(prisma.clerkEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_1' },
      data: expect.objectContaining({ status: WebhookEventStatus.PROCESSED }),
    }));
  });

  it('syncs user.updated fixture data without welcome email side effects', async () => {
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
    vi.mocked(UserService.syncUser).mockResolvedValue({ id: 'user_1' } as never);

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(UserService.syncUser).toHaveBeenCalledWith('user_1', 'updated@example.com', 'Jan', null, undefined, 'pl', 'jan');
    expect(EmailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('soft-deletes user.deleted fixture data and sends deletion email for active accounts', async () => {
    const payload = { type: 'user.deleted', data: { id: 'user_1' } };
    mockVerifiedEvent(payload);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'old@example.com', language: 'pl' } as never);

    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    expect(UserService.softDeleteUser).toHaveBeenCalledWith('user_1');
    expect(EmailService.sendAccountDeletedEmail).toHaveBeenCalledWith('old@example.com');
  });

  it('short-circuits processed duplicate events without running user side effects', async () => {
    vi.mocked(prisma.clerkEvent.findUnique).mockResolvedValue({
      status: WebhookEventStatus.PROCESSED,
      updatedAt: new Date(),
    } as never);
    const payload = { type: 'user.created', data: { id: 'user_1' } };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, duplicate: true, processing: false });
    expect(prisma.clerkEvent.upsert).not.toHaveBeenCalled();
    expect(UserService.syncUser).not.toHaveBeenCalled();
  });

  it('short-circuits fresh in-flight events so parallel deliveries are idempotent', async () => {
    vi.mocked(prisma.clerkEvent.findUnique).mockResolvedValue({
      status: WebhookEventStatus.PROCESSING,
      updatedAt: new Date(),
    } as never);
    const payload = { type: 'user.updated', data: { id: 'user_1' } };
    mockVerifiedEvent(payload);

    const response = await POST(requestFor(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, duplicate: false, processing: true });
    expect(prisma.clerkEvent.upsert).not.toHaveBeenCalled();
    expect(UserService.syncUser).not.toHaveBeenCalled();
  });
});
