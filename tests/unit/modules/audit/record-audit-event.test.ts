import { describe, it, expect, vi } from 'vitest';
import { recordAuditEvent } from '@/lib/modules/audit';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('recordAuditEvent Use Case', () => {
  it('calls repository with correct field mapping from actor', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'admin', userId: 'admin-456' },
    });

    const result = await recordAuditEvent(ctx, {
      action: 'TEST_ACTION',
      targetType: 'VIDEO',
      targetId: 'video-1',
      metadata: { foo: 'bar' },
    });

    expect(result.id).toBe('log-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-456',
        action: 'TEST_ACTION',
        targetType: 'VIDEO',
        targetId: 'video-1',
        metadata: { foo: 'bar' },
      },
    });
  });

  it('handles guest actor correctly', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-2' }),
      },
    };

    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'guest' },
    });

    await recordAuditEvent(ctx, { action: 'GUEST_ACTION' });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: undefined,
          action: 'GUEST_ACTION',
        }),
      })
    );
  });
});
