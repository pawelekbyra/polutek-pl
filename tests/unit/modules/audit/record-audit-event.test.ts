import { describe, it, expect, vi } from 'vitest';
import { recordAuditEvent } from '@/lib/modules/audit';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('recordAuditEvent Use Case', () => {
  it('calls repository to create audit log', async () => {
    const mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const ctx = createAppContext({
      prisma: mockPrisma as any,
      userId: 'user-123',
    });

    const result = await recordAuditEvent(ctx, {
      action: 'TEST_ACTION',
      resourceType: 'VIDEO',
      resourceId: 'video-1',
      metadata: { foo: 'bar' },
    });

    expect(result.id).toBe('log-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        action: 'TEST_ACTION',
        resourceType: 'VIDEO',
        resourceId: 'video-1',
        metadata: { foo: 'bar' },
      },
    });
  });
});
