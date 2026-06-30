import { describe, it, expect, vi } from 'vitest';
import { PatronRepository } from '@/lib/modules/patron/infrastructure/patron.repository';

describe('PatronRepository.listActiveGrants logic', () => {
  it('returns only grants where revokedAt is null', async () => {
    const activeGrant = { id: 'g1', userId: 'u1', source: 'ADMIN', createdAt: new Date('2024-01-01'), revokedAt: null };
    const mockDb = {
      patronGrant: {
        findMany: vi.fn().mockResolvedValue([activeGrant]),
      },
    } as any;

    const repo = new PatronRepository();
    const grants = await repo.listActiveGrants('u1', mockDb);

    expect(mockDb.patronGrant.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    expect(grants).toHaveLength(1);
    expect(grants[0].id).toBe('g1');
  });

  it('returns empty array when no active grants exist', async () => {
    const mockDb = {
      patronGrant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const repo = new PatronRepository();
    const grants = await repo.listActiveGrants('u1', mockDb);

    expect(grants).toHaveLength(0);
  });

  it('orders grants by createdAt ascending', async () => {
    const grant1 = { id: 'g1', userId: 'u1', source: 'ADMIN', createdAt: new Date('2024-01-01'), revokedAt: null };
    const grant2 = { id: 'g2', userId: 'u1', source: 'STRIPE_TIP', createdAt: new Date('2025-01-01'), revokedAt: null };
    const mockDb = {
      patronGrant: {
        findMany: vi.fn().mockResolvedValue([grant1, grant2]),
      },
    } as any;

    const repo = new PatronRepository();
    const grants = await repo.listActiveGrants('u1', mockDb);

    expect(grants[0].id).toBe('g1');
    expect(grants[1].id).toBe('g2');
  });
});
