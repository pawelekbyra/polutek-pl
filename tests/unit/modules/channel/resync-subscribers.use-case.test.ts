import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resyncSubscribers } from '@/lib/modules/channel/application/resync-subscribers.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { AppError } from '@/lib/modules/shared/app-error';
import { ChannelRepository } from '@/lib/modules/channel/infrastructure/channel.repository';

vi.mock('@/lib/modules/channel/infrastructure/channel.repository', () => {
  return {
    ChannelRepository: vi.fn()
  };
});

describe('ResyncSubscribersUseCase', () => {
  const ctx = createAppContext({
    actor: { type: 'admin', userId: 'admin-1' }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resync subscribers for all creators', async () => {
    const mockRepo = {
      findAllCreators: vi.fn().mockResolvedValue([{ id: 'creator-1' }, { id: 'creator-2' }]),
      syncSubscribersCount: vi.fn().mockImplementation((id) => Promise.resolve({
        id,
        subscribersCount: id === 'creator-1' ? 10 : 20
      })),
    };
    (ChannelRepository as any).prototype.findAllCreators = mockRepo.findAllCreators;
    (ChannelRepository as any).prototype.syncSubscribersCount = mockRepo.syncSubscribersCount;

    const result = await resyncSubscribers(ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.updated).toHaveLength(2);
      expect(result.data.updated).toContainEqual({ creatorId: 'creator-1', subscribersCount: 10 });
      expect(result.data.updated).toContainEqual({ creatorId: 'creator-2', subscribersCount: 20 });
    }
  });

  it('should fail if actor is not an admin', async () => {
    const guestCtx = createAppContext({
      actor: { type: 'guest' }
    });

    const result = await resyncSubscribers(guestCtx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.statusCode).toBe(403);
    }
  });
});
