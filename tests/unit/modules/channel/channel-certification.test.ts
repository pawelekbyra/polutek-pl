import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from '@/lib/modules/channel/domain/channel.errors';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Channel Module Certification', () => {
  const mockPrisma = {
    creator: {
      findUnique: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MAIN_CREATOR_SLUG', 'test-slug');
  });

  const ctx = createAppContext({ prisma: mockPrisma });

  it('getRequired throws MainChannelNotFoundError when channel missing', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(null);
    await expect(MainChannelService.getRequired(ctx)).rejects.toThrow(MainChannelNotFoundError);
  });

  it('getRequired throws MainChannelNotApprovedError when channel not approved', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', slug: 'test-slug', isApproved: false, isPrimary: true });
    await expect(MainChannelService.getRequired(ctx)).rejects.toThrow(MainChannelNotApprovedError);
  });

  it('getRequired throws MainChannelNotPrimaryError when channel not primary', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue({ id: '1', slug: 'test-slug', isApproved: true, isPrimary: false });
    await expect(MainChannelService.getRequired(ctx)).rejects.toThrow(MainChannelNotPrimaryError);
  });

  it('getOptional does not auto-create channel', async () => {
    mockPrisma.creator.findUnique.mockResolvedValue(null);
    const result = await MainChannelService.getOptional(ctx);
    expect(result).toBeNull();
    expect(mockPrisma.creator.findUnique).toHaveBeenCalledOnce();
  });
});
