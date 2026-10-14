import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { MainChannelNotFoundError, MainChannelNotApprovedError } from '@/lib/modules/channel/domain/channel.errors';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Channel Module Certification', () => {
  const mockPrisma = {
    appSetting: { findUnique: vi.fn() },
    creator: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.appSetting.findUnique.mockResolvedValue({ key: 'main_channel_id', value: '1' });
    mockPrisma.creator.findFirst.mockResolvedValue(null);
  });

  // A fresh context per test: the main-channel read is memoized per database client within a render.
  const ctxFor = () => createAppContext({ prisma: { ...mockPrisma } });

  it('getRequired throws MainChannelNotFoundError when channel missing', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(null);
    await expect(MainChannelService.getRequired(ctxFor())).rejects.toThrow(MainChannelNotFoundError);
  });

  it('getRequired throws MainChannelNotApprovedError when the channel is not publicly visible', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', slug: 'test-slug', status: 'PENDING_REVIEW', deletedAt: null });
    await expect(MainChannelService.getRequired(ctxFor())).rejects.toThrow(MainChannelNotApprovedError);
  });

  it('getRequired returns an ACTIVE channel without any isApproved or isPrimary flag', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', slug: 'test-slug', status: 'ACTIVE', deletedAt: null });
    await expect(MainChannelService.getRequired(ctxFor())).resolves.toMatchObject({ id: '1' });
  });

  it('getOptional does not auto-create channel', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(null);
    const result = await MainChannelService.getOptional(ctxFor());
    expect(result).toBeNull();
    expect(mockPrisma.creator.findUnique).toHaveBeenCalledOnce();
  });
});
