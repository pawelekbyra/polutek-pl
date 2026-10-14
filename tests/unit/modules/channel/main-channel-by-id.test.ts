import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { createAppContext } from '@/lib/modules/shared/app-context';

const findById = vi.fn();

vi.mock('@/lib/modules/channel/infrastructure/channel.repository', () => ({
  ChannelRepository: vi.fn().mockImplementation(function () {
    return { findById, findMainChannel: vi.fn() };
  }),
}));

describe('MainChannelService addressing a channel by id (subscriptions)', () => {
  let n = 0;
  const ctx = () => createAppContext({ actor: { type: 'user', userId: 'u1' }, prisma: { id: `db-${++n}` } as any });

  beforeEach(() => {
    findById.mockReset();
  });

  it.each(['ACTIVE', 'LIMITED'])('serves a %s channel', async (status) => {
    findById.mockResolvedValue({ id: 'c2', slug: 'other', status, deletedAt: null });

    await expect(MainChannelService.getPubliclyVisibleById(ctx(), 'c2')).resolves.toMatchObject({ id: 'c2' });
  });

  it.each(['SUSPENDED', 'BANNED', 'PENDING_REVIEW', 'DELETED'])('treats a %s channel as not found', async (status) => {
    findById.mockResolvedValue({ id: 'c2', slug: 'other', status, deletedAt: null });

    await expect(MainChannelService.getPubliclyVisibleById(ctx(), 'c2')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('treats a soft-deleted and a missing channel as the same 404', async () => {
    findById.mockResolvedValueOnce({ id: 'c2', status: 'ACTIVE', deletedAt: new Date() });
    await expect(MainChannelService.getPubliclyVisibleById(ctx(), 'c2')).rejects.toMatchObject({ statusCode: 404 });

    findById.mockResolvedValueOnce(null);
    await expect(MainChannelService.getPubliclyVisibleById(ctx(), 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('getAnyById returns a hidden channel (so it can be left) but 404 for a missing one', async () => {
    findById.mockResolvedValueOnce({ id: 'c2', status: 'SUSPENDED', deletedAt: null });
    await expect(MainChannelService.getAnyById(ctx(), 'c2')).resolves.toMatchObject({ id: 'c2' });

    findById.mockResolvedValueOnce(null);
    await expect(MainChannelService.getAnyById(ctx(), 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});
