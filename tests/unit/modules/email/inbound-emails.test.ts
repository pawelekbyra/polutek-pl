import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listInboundEmails } from '@/lib/modules/email/application/list-inbound-emails.use-case';
import { updateInboundEmail } from '@/lib/modules/email/application/update-inbound-email.use-case';
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
    actor: { type: 'admin', userId: 'admin1' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listInboundEmails', () => {
    it('returns a list of inbound emails', async () => {
      const mockEmails = [
        { id: '1', fromEmail: 'user@example.com', status: 'NEW' },
        { id: '2', fromEmail: 'other@example.com', status: 'READ' },
      ];
      prismaMock.inboundEmail.findMany.mockResolvedValue(mockEmails);

      const result = await listInboundEmails(ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockEmails);
        expect(prismaMock.inboundEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          take: 50,
        }));
      }
    });

    it('returns an error if findMany fails', async () => {
      prismaMock.inboundEmail.findMany.mockRejectedValue(new Error('DB Error'));

      const result = await listInboundEmails(ctx);

      expect(result.ok).toBe(false);
    });
  });

  describe('updateInboundEmail', () => {
    it('updates the status of an inbound email', async () => {
      const mockUpdated = { id: '1', status: 'ARCHIVED' };
      prismaMock.inboundEmail.update.mockResolvedValue(mockUpdated);

      const result = await updateInboundEmail(ctx, { id: '1', status: 'ARCHIVED' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockUpdated);
        expect(prismaMock.inboundEmail.update).toHaveBeenCalledWith({
          where: { id: '1' },
          data: { status: 'ARCHIVED' },
        });
      }
    });

    it('returns an error if update fails', async () => {
      prismaMock.inboundEmail.update.mockRejectedValue(new Error('Update failed'));

      const result = await updateInboundEmail(ctx, { id: '1', status: 'ARCHIVED' });

      expect(result.ok).toBe(false);
    });

    it('returns 404 error if email not found', async () => {
      const prismaError = new Error('Not found');
      (prismaError as any).code = 'P2025';
      prismaMock.inboundEmail.update.mockRejectedValue(prismaError);

      const result = await updateInboundEmail(ctx, { id: 'nonexistent', status: 'ARCHIVED' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.statusCode).toBe(404);
        expect(result.error.code).toBe('INBOUND_EMAIL_NOT_FOUND');
      }
    });
  });
});
