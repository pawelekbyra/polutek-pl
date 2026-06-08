import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainChannelMaintenance } from '@/lib/channel/main-channel.maintenance';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creator: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    video: { updateMany: vi.fn(), count: vi.fn() },
    comment: { updateMany: vi.fn(), count: vi.fn() },
    payment: { updateMany: vi.fn(), count: vi.fn() },
    subscription: { updateMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('@/lib/feature-flags', () => ({
  flags: {
    mainCreatorSlug: 'test-slug',
  },
}));

describe('MainChannelMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.video.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.comment.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'log-1' } as any);
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
    await expect(MainChannelMaintenance.applyOwnershipRepair('admin1', 'c1', 'WRONG'))
      .rejects.toThrow(/Invalid confirmation phrase/);

    await MainChannelMaintenance.applyOwnershipRepair('admin1', 'c1', 'CONFIRM OWNERSHIP REPAIR');
    expect(prisma.video.updateMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('applyPrimaryRepair requires correct confirmation phrase', async () => {
    await expect(MainChannelMaintenance.applyPrimaryRepair('admin1', 'c1', 'WRONG'))
      .rejects.toThrow(/Invalid confirmation phrase/);

    await MainChannelMaintenance.applyPrimaryRepair('admin1', 'c1', 'CONFIRM PRIMARY REPAIR');
    expect(prisma.creator.updateMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
