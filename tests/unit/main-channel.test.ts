import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainChannelService } from '@/lib/channel/main-channel.service';
import { MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from '@/lib/channel/main-channel.errors';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    mainCreatorSlug: 'test-slug',
  },
}));

describe('MainChannelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getConfiguredSlug returns the slug from flags', () => {
    expect(MainChannelService.getConfiguredSlug()).toBe('test-slug');
  });

  it('getOptional returns channel if it exists', async () => {
    const mockChannel = { id: '1', slug: 'test-slug' };
    vi.mocked(prisma.creator.findUnique).mockResolvedValue(mockChannel as any);

    const result = await MainChannelService.getOptional();
    expect(result).toEqual(mockChannel);
    expect(prisma.creator.findUnique).toHaveBeenCalledWith({ where: { slug: 'test-slug' } });
  });

  it('getRequired throws if channel missing', async () => {
    vi.mocked(prisma.creator.findUnique).mockResolvedValue(null);
    await expect(MainChannelService.getRequired()).rejects.toThrow(MainChannelNotFoundError);
  });

  it('getRequired throws if channel not approved', async () => {
    vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: '1', slug: 'test-slug', isApproved: false } as any);
    await expect(MainChannelService.getRequired()).rejects.toThrow(MainChannelNotApprovedError);
  });

  it('getRequired throws if channel not primary', async () => {
    vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: '1', slug: 'test-slug', isApproved: true, isPrimary: false } as any);
    await expect(MainChannelService.getRequired()).rejects.toThrow(MainChannelNotPrimaryError);
  });

  it('getRequired returns channel if all checks pass', async () => {
    const mockChannel = { id: '1', slug: 'test-slug', isApproved: true, isPrimary: true };
    vi.mocked(prisma.creator.findUnique).mockResolvedValue(mockChannel as any);

    const result = await MainChannelService.getRequired();
    expect(result).toEqual(mockChannel);
  });
});

describe('MainChannelMaintenance phrases', () => {
    it('requires correct phrases for maintenance actions', () => {
        // This is a placeholder to ensure the phrases are respected if we add unit tests for maintenance
        // Currently tested via logic in maintenance.ts
    });
});
