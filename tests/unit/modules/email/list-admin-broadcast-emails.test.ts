import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdminBroadcastEmails } from '@/lib/modules/email/application/list-admin-broadcast-emails.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('listAdminBroadcastEmails use case', () => {
  const prismaMock = {
    broadcastEmail: {
      findMany: vi.fn(),
    },
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'system', reason: 'test' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns broadcast history items', async () => {
    const now = new Date();
    prismaMock.broadcastEmail.findMany.mockResolvedValue([
      {
          id: 'b1',
          subjectPl: 'Hello',
          status: 'SENT',
          recipientGroup: 'ALL',
          recipientCount: 10,
          sentCount: 10,
          errorCount: 0,
          sentAt: now,
          createdAt: now,
          createdById: 'admin_1'
      },
    ]);

    const result = await listAdminBroadcastEmails(ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('b1');
        expect(result.data[0].subjectPl).toBe('Hello');
    }
  });

  it('handles empty history', async () => {
    prismaMock.broadcastEmail.findMany.mockResolvedValue([]);

    const result = await listAdminBroadcastEmails(ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data).toHaveLength(0);
    }
  });
});
