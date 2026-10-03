import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';
import { setVideoReaction } from '@/lib/actions/interactions';
import { setVideoReaction as setVideoReactionUseCase } from '@/lib/modules/comments';
import { getActorFromAuth } from '@/lib/api/auth';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/api/auth', () => ({ getActorFromAuth: vi.fn() }));
vi.mock('@/lib/modules/comments', () => ({ setVideoReaction: vi.fn() }));

describe('setVideoReaction server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'u1' } as any);
    vi.mocked(setVideoReactionUseCase).mockResolvedValue({ ok: true, data: { liked: true, disliked: false, likesCount: 5, dislikesCount: 1 } });
  });

  it('returns the new counters without re-rendering the page on the server', async () => {
    const result = await setVideoReaction('video-1', 'LIKE');
    expect(result).toEqual({ liked: true, disliked: false, likesCount: 5, dislikesCount: 1 });
    expect(setVideoReactionUseCase).toHaveBeenCalledWith({ videoId: 'video-1', reaction: 'LIKE' }, expect.anything());
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects arguments a client could forge', async () => {
    const result = await setVideoReaction('video-1', 'LOVE' as any);
    expect(result).toEqual({ error: 'VALIDATION_ERROR', message: 'Nieprawidłowe dane.' });
    expect(setVideoReactionUseCase).not.toHaveBeenCalled();
  });

  it('passes the use case error type through with its safe message', async () => {
    vi.mocked(setVideoReactionUseCase).mockResolvedValue({ ok: false, error: { type: 'UNAUTHORIZED', message: 'Musisz być zalogowany, aby ocenić film.' } });
    expect(await setVideoReaction('video-1', null)).toEqual({ error: 'UNAUTHORIZED', message: 'Musisz być zalogowany, aby ocenić film.' });
  });

  it('an unexpected failure returns a generic message, not the exception text', async () => {
    vi.mocked(setVideoReactionUseCase).mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const result = await setVideoReaction('video-1', 'DISLIKE');
    expect(result.error).toBe('INTERNAL_ERROR');
    expect('message' in result && result.message).not.toContain('ECONNREFUSED');
  });
});
