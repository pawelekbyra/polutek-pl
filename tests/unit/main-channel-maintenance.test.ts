import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainChannelMaintenance } from '@/lib/channel/main-channel.maintenance';
import { prisma } from '@/lib/prisma';
import { MainChannelService } from '@/lib/channel/main-channel.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    video: { updateMany: vi.fn(), count: vi.fn() },
    comment: { updateMany: vi.fn(), count: vi.fn() },
    payment: { updateMany: vi.fn(), count: vi.fn() },
    subscription: { updateMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('@/lib/channel/main-channel.service', () => ({
  MainChannelService: {
    getConfiguredSlug: vi.fn(() => 'test-slug'),
  },
}));

describe('MainChannelMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.video.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.comment.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as any);
  });

  it('applyMainChannelSetup requires correct confirmation phrase', async () => {
    await expect(MainChannelMaintenance.applyMainChannelSetup('admin1', 'WRONG'))
      .rejects.toThrow(/Invalid confirmation phrase/);

    vi.mocked(prisma.creator.findUnique).mockResolvedValue({ id: 'c1', slug: 'test-slug' } as any);

    // Should proceed with correct phrase
    await MainChannelMaintenance.applyMainChannelSetup('admin1', 'CONFIRM SETUP MAIN CHANNEL');
    expect(prisma.creator.findUnique).toHaveBeenCalled();
  });

  it('applyOwnershipRepair requires correct confirmation phrase', async () => {
    await expect(MainChannelMaintenance.applyOwnershipRepair('c1', 'WRONG'))
      .rejects.toThrow(/Invalid confirmation phrase/);

    await MainChannelMaintenance.applyOwnershipRepair('c1', 'CONFIRM OWNERSHIP REPAIR');
    expect(prisma.video.updateMany).toHaveBeenCalled();
  });

  it('applyPrimaryRepair requires correct confirmation phrase', async () => {
    await expect(MainChannelMaintenance.applyPrimaryRepair('c1', 'WRONG'))
      .rejects.toThrow(/Invalid confirmation phrase/);

    await MainChannelMaintenance.applyPrimaryRepair('c1', 'CONFIRM PRIMARY REPAIR');
    expect(prisma.creator.updateMany).toHaveBeenCalled();
  });
});
