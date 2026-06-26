import { describe, it, expect, vi } from 'vitest';
import { PatronRepository } from '@/lib/modules/patron/infrastructure/patron.repository';
import { PatronGrantSource } from '@prisma/client';

describe('PatronRepository.updateUserPatronFields logic', () => {
  it('preserves existing patronSince when preserveExistingPatronSince option is true', async () => {
    const historicalDate = new Date('2020-01-01');
    const mockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ patronSince: historicalDate }),
        update: vi.fn().mockResolvedValue({ id: 'u1', paymentTotals: [] }),
      },
    } as any;

    const repo = new PatronRepository();
    await repo.updateUserPatronFields(
      'u1',
      { isPatron: true, patronSince: new Date(), patronSource: PatronGrantSource.ADMIN },
      mockTx,
      { preserveExistingPatronSince: true }
    );

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        isPatron: true,
        patronSource: PatronGrantSource.ADMIN,
      },
      include: { paymentTotals: true },
    });
    // Ensure patronSince was NOT in the data object
    const updateData = mockTx.user.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('patronSince');
  });

  it('updates patronSince when no existing patronSince exists even if preserve is true', async () => {
    const newDate = new Date('2026-01-01');
    const mockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ patronSince: null }),
        update: vi.fn().mockResolvedValue({ id: 'u1', paymentTotals: [] }),
      },
    } as any;

    const repo = new PatronRepository();
    await repo.updateUserPatronFields(
      'u1',
      { isPatron: true, patronSince: newDate, patronSource: PatronGrantSource.ADMIN },
      mockTx,
      { preserveExistingPatronSince: true }
    );

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        isPatron: true,
        patronSource: PatronGrantSource.ADMIN,
        patronSince: newDate,
      },
      include: { paymentTotals: true },
    });
  });

  it('updates patronSince when preserveExistingPatronSince is false', async () => {
    const newDate = new Date('2026-01-01');
    const mockTx = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'u1', paymentTotals: [] }),
      },
    } as any;

    const repo = new PatronRepository();
    await repo.updateUserPatronFields(
      'u1',
      { isPatron: true, patronSince: newDate, patronSource: PatronGrantSource.ADMIN },
      mockTx,
      { preserveExistingPatronSince: false }
    );

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        isPatron: true,
        patronSource: PatronGrantSource.ADMIN,
        patronSince: newDate,
      },
      include: { paymentTotals: true },
    });
    expect(mockTx.user.findUnique).not.toHaveBeenCalled();
  });
});
