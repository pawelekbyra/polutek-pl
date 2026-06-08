import { describe, it, expect, vi } from 'vitest';
import { recordAuditEvent } from '@/lib/modules/audit';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('recordAuditEvent Use Case', () => {
  it('calls repository with correct field mapping', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const ctx = createAppContext({
      prisma: mockPrisma as any,
      actor: { type: 'user', userId: 'user-123', isPatron: false },
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
        actorUserId: 'user-123',
        action: 'TEST_ACTION',
        targetType: 'VIDEO',
        targetId: 'video-1',
        metadata: { foo: 'bar' },
      },
    });
  });
});
