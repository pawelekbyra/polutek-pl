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

  it('rejects invalid test payload when no email provided', async () => {
    const result = await sendAdminBroadcastEmail(ctx, {
      subjectPl: 'Test',
      htmlPl: 'Test',
      subjectEn: 'Test',
      htmlEn: 'Test',
      isTest: true,
      testEmail: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error.code).toBe('INVALID_BROADCAST_PAYLOAD');
    }
  });

  it('creates a broadcast and triggers background sending for valid input', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'u1@ex.com', language: 'pl', name: 'U1' },
    ]);
    prismaMock.broadcastEmail.create.mockResolvedValue({ id: 'b1' });

    const result = await sendAdminBroadcastEmail(ctx, {
      subjectPl: 'Pl',
      htmlPl: 'Pl',
      subjectEn: 'En',
      htmlEn: 'En',
      recipientGroup: 'ALL',
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.broadcastEmail.create).toHaveBeenCalled();
    expect(prismaMock.broadcastEmailRecipient.createMany).toHaveBeenCalled();
    expect(EmailService.sendBroadcast).toHaveBeenCalledWith('b1');
  });

  it('handles empty recipient list gracefully', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await sendAdminBroadcastEmail(ctx, {
      subjectPl: 'Pl',
      htmlPl: 'Pl',
      subjectEn: 'En',
      htmlEn: 'En',
      recipientGroup: 'PATRONS',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data.recipientCount).toBe(0);
    }
    expect(prismaMock.broadcastEmail.create).not.toHaveBeenCalled();
  });
});
