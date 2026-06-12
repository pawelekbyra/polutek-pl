import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendAdminBroadcastEmail } from '@/lib/modules/email/application/send-admin-broadcast-email.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

const { mockSendBroadcast, mockSendTestEmail } = vi.hoisted(() => ({
  mockSendBroadcast: vi.fn(),
  mockSendTestEmail: vi.fn(),
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: { mainCreatorSlug: 'polutek' },
}));

vi.mock('@/lib/modules/email/infrastructure/legacy-email-service-provider', () => {
  return {
    LegacyEmailServiceProvider: vi.fn().mockImplementation(function() {
      return {
        sendBroadcast: mockSendBroadcast,
        sendTestEmail: mockSendTestEmail,
      };
    }),
  };
});

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('sendAdminBroadcastEmail use case - hardening', () => {
  const prismaMock = {
    user: { findMany: vi.fn() },
    broadcastEmail: { create: vi.fn() },
    broadcastEmailRecipient: { createMany: vi.fn() },
    emailPreference: { findUnique: vi.fn() },
    creator: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'admin', userId: 'admin_1' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBroadcast.mockResolvedValue({ sent: 1, failed: 0, messageIds: ['b1'] });
    mockSendTestEmail.mockResolvedValue({ messageId: 'test-id' });
    prismaMock.emailPreference.findUnique.mockResolvedValue(null);
    prismaMock.creator.findUnique.mockResolvedValue({ id: 'c1' });
    prismaMock.subscription.findUnique.mockResolvedValue({ id: 's1' });
  });

  it('rejects missing subject or body', async () => {
    const result = await sendAdminBroadcastEmail(ctx, {
      subject: '',
      body: '',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMAIL_INVALID_PAYLOAD');
  });

  it('uses provider bridge for TEST audience instead of direct Resend', async () => {
    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Test',
      body: 'Test',
      audience: 'TEST',
      testRecipientEmail: 'test@example.com',
    });

    expect(result.ok).toBe(true);
    expect(mockSendTestEmail).toHaveBeenCalled();
  });

  it('skips MANUAL audience recipients without verifiable user subscription', async () => {
    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Manual',
      body: 'Body',
      audience: 'MANUAL',
      manualRecipients: [{ email: 'manual@example.com', name: 'Manual User' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recipientCount).toBe(0);
    expect(prismaMock.broadcastEmailRecipient.createMany).not.toHaveBeenCalled();
  });

  it('deduplicates recipient emails', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'duplicate@ex.com', language: 'pl', name: 'U1', isPatron: false },
      { id: 'u2', email: 'DUPLICATE@ex.com', language: 'pl', name: 'U2', isPatron: false },
    ]);
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Dedupe',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recipientCount).toBe(1);
  });

  it('maps provider failure to EMAIL_PROVIDER_FAILED', async () => {
    mockSendBroadcast.mockRejectedValueOnce(new Error('Provider down'));
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', email: 'u1@ex.com', language: 'pl', name: 'U1' }]);
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Fail',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMAIL_PROVIDER_FAILED');
  });

  it('filters out recipients based on negative preference override', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'optout@ex.com', language: 'pl', name: 'Opt Out', isPatron: false },
      { id: 'u2', email: 'optin@ex.com', language: 'pl', name: 'Opt In', isPatron: false },
    ]);
    prismaMock.emailPreference.findUnique.mockImplementation(async ({ where }) => {
      if (where.email === 'optout@ex.com') return { marketingEmails: false };
      return { marketingEmails: true };
    });
    prismaMock.subscription.findUnique.mockImplementation(async ({ where }) => {
      if (where.userId_creatorId.userId === 'u1') return { id: 's1' };
      if (where.userId_creatorId.userId === 'u2') return { id: 's2' };
      return null;
    });
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Pref Check',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recipientCount).toBe(1);
    expect(prismaMock.broadcastEmailRecipient.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ email: 'optin@ex.com' })]),
    }));
  });

  it('requires active Subscription; marketingEmails true alone is skipped', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'legacytrue@ex.com', language: 'pl', name: 'Legacy', isPatron: false },
    ]);
    prismaMock.emailPreference.findUnique.mockResolvedValue({ marketingEmails: true });
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'No subscription',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recipientCount).toBe(0);
    expect(prismaMock.broadcastEmailRecipient.createMany).not.toHaveBeenCalled();
  });

  it('allows active Subscription with missing EmailPreference', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'subscribed@ex.com', language: 'pl', name: 'Sub', isPatron: false },
    ]);
    prismaMock.emailPreference.findUnique.mockResolvedValue(null);
    prismaMock.subscription.findUnique.mockResolvedValue({ id: 's1' });
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Subscribed',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recipientCount).toBe(1);
    expect(prismaMock.broadcastEmailRecipient.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ email: 'subscribed@ex.com', userId: 'u1' })],
    }));
  });
});
