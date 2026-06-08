import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMainChannel, getRequiredMainChannel } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { flags } from '@/lib/feature-flags';

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    mainCreatorSlug: 'test-slug'
  }
}));

describe('Channel Module Use Cases', () => {
  const mockPrisma = {
    creator: {
      findUnique: vi.fn(),
    },
  };

  const ctx = createAppContext({ prisma: mockPrisma as any });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMainChannel', () => {
    it('returns channel from repository', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'chan-1', slug: 'test-slug' });
      const result = await getMainChannel(ctx);
      expect(result?.id).toBe('chan-1');
      expect(mockPrisma.creator.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-slug' }
      });
    });
  });

  describe('getRequiredMainChannel', () => {
    it('throws if channel not found', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);
      await expect(getRequiredMainChannel(ctx)).rejects.toThrow('test-slug');
    });

    it('throws if not approved', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', isApproved: false });
      await expect(getRequiredMainChannel(ctx)).rejects.toThrow('not approved');
    });

    it('returns channel if all checks pass', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({
        id: '1',
        isApproved: true,
        isPrimary: true
      });
      const result = await getRequiredMainChannel(ctx);
      expect(result.id).toBe('1');
    });
  });
});
