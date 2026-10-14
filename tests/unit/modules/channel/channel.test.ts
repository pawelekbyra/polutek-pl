import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMainChannel, getRequiredMainChannel } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Channel Module Use Cases', () => {
  const mockPrisma = {
    appSetting: { findUnique: vi.fn() },
    creator: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.appSetting.findUnique.mockResolvedValue({ key: 'main_channel_id', value: 'chan-1' });
    mockPrisma.creator.findFirst.mockResolvedValue(null);
  });

  // The main-channel read is memoized per database client within a render, so each test gets its own context.
  const ctxFor = () => createAppContext({ prisma: { ...mockPrisma } as any });

  describe('getMainChannel', () => {
    it('returns the channel named by the main_channel_id setting', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: 'chan-1', slug: 'test-slug' });
      const result = await getMainChannel(ctxFor());
      expect(result?.id).toBe('chan-1');
      expect(mockPrisma.appSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'main_channel_id' } });
      expect(mockPrisma.creator.findUnique).toHaveBeenCalledWith({ where: { id: 'chan-1' } });
    });
  });

  describe('getRequiredMainChannel', () => {
    it('throws if channel not found', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);
      await expect(getRequiredMainChannel(ctxFor())).rejects.toThrow('not found');
    });

    it('throws if the channel is not publicly visible', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', slug: 'c', status: 'PENDING_REVIEW', deletedAt: null });
      await expect(getRequiredMainChannel(ctxFor())).rejects.toThrow('not publicly visible');
    });

    it('returns an ACTIVE channel', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', slug: 'c', status: 'ACTIVE', deletedAt: null });
      const result = await getRequiredMainChannel(ctxFor());
      expect(result.id).toBe('1');
    });
  });
});
