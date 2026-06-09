import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listInboundEmails } from '@/lib/modules/email/application/list-inbound-emails.use-case';
import { updateInboundEmailStatus } from '@/lib/modules/email/application/update-inbound-email-status.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Inbound Email Use Cases', () => {
  const prismaMock = {
    inboundEmail: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'system', reason: 'test' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listInboundEmails returns items', async () => {
    prismaMock.inboundEmail.findMany.mockResolvedValue([{ id: 'i1', subject: 'Hi' }]);
    const result = await listInboundEmails(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.data).toHaveLength(1);
    }
  });

  it('updateInboundEmailStatus updates status', async () => {
    prismaMock.inboundEmail.update.mockResolvedValue({ id: 'i1', status: 'READ' });
    const result = await updateInboundEmailStatus(ctx, 'i1', 'READ');
    expect(result.ok).toBe(true);
    expect(prismaMock.inboundEmail.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'i1' },
        data: { status: 'READ' }
    }));
  });
});
