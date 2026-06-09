import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendAdminBroadcastEmail } from '@/lib/modules/email/application/send-admin-broadcast-email.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { EmailService } from '@/lib/services/email.service';

vi.mock('@/lib/services/email.service', () => ({
  EmailService: {
    sendBroadcast: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: 'test_id' }, error: null }),
      },
    })),
  };
});

describe('sendAdminBroadcastEmail use case', () => {
  const prismaMock = {
    user: {
      findMany: vi.fn(),
    },
    broadcastEmail: {
      create: vi.fn(),
    },
    broadcastEmailRecipient: {
      createMany: vi.fn(),
    },
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'admin', userId: 'admin_1' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing subject or body', async () => {
    const result = await sendAdminBroadcastEmail(ctx, {
      subject: '',
      body: '',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_INVALID_PAYLOAD');
    }
  });

  it('rejects missing test recipient for TEST audience', async () => {
    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Test',
      body: 'Test',
      audience: 'TEST',
      testRecipientEmail: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_TEST_RECIPIENT_REQUIRED');
    }
  });

  it('implements dryRun: true correctly', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'u1@ex.com', language: 'pl', name: 'U1', isPatron: false },
      { id: 'u2', email: 'u2@ex.com', language: 'pl', name: 'U2', isPatron: false },
    ]);

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Dry Run',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.dryRun).toBe(true);
        expect(result.data.recipientCount).toBe(2);
        expect(result.data.skipped).toBe(2);
    }
    expect(prismaMock.broadcastEmail.create).not.toHaveBeenCalled();
    expect(EmailService.sendBroadcast).not.toHaveBeenCalled();
  });

  it('supports PATRONS audience', async () => {
    prismaMock.user.findMany.mockResolvedValue([
        { id: 'p1', email: 'p1@ex.com', language: 'pl', name: 'P1', isPatron: true },
    ]);
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Patrons Only',
      body: 'Body',
      audience: 'PATRONS',
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isPatron: true })
    }));
    expect(EmailService.sendBroadcast).toHaveBeenCalledWith('b1');
  });

  it('supports NON_PATRONS audience', async () => {
    prismaMock.user.findMany.mockResolvedValue([
        { id: 'np1', email: 'np1@ex.com', language: 'pl', name: 'NP1', isPatron: false },
    ]);
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Non-Patrons Only',
      body: 'Body',
      audience: 'NON_PATRONS',
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isPatron: false })
    }));
  });

  it('handles empty recipient list correctly', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await sendAdminBroadcastEmail(ctx, {
      subject: 'Nobody',
      body: 'Body',
      audience: 'ALL_SUBSCRIBERS',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.recipientCount).toBe(0);
    }
    expect(prismaMock.broadcastEmail.create).not.toHaveBeenCalled();
  });
});
