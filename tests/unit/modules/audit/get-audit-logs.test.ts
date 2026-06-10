import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuditLogs } from '@/lib/modules/audit/application/get-audit-logs.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('getAuditLogs Use Case', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        findMany: vi.fn(),
      },
    };
  });

  it('returns audit logs for a target', async () => {
    const logs = [
      { id: '1', action: 'UPDATE', targetType: 'Video', targetId: 'v1', createdAt: new Date() },
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(logs);

    const ctx = createAppContext({ actor: { type: 'admin', userId: 'admin-1' }, prisma: mockPrisma });
    const result = await getAuditLogs({ targetType: 'Video', targetId: 'v1' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1');
    }
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { targetType: 'Video', targetId: 'v1' }
    }));
  });
});
