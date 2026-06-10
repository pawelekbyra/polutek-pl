import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPlaybackEventUseCase } from '@/lib/modules/video/application/record-playback-event.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { checkVideoAccess } from '@/lib/modules/access';
import { PlaybackAccessDeniedError } from '@/lib/modules/video/domain/video.errors';

vi.mock('@/lib/modules/access', () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  setNxEx: vi.fn().mockResolvedValue(true),
}));

// Mock the repository to avoid DB calls
vi.mock('@/lib/modules/video/infrastructure/video-playback.repository', () => {
  return {
    VideoPlaybackRepository: function() {
      return {
        findSessionById: vi.fn().mockResolvedValue(null),
        updateSession: vi.fn().mockResolvedValue({}),
        createEvent: vi.fn().mockResolvedValue({}),
        recordView: vi.fn().mockResolvedValue({}),
        markSessionAsViewed: vi.fn().mockResolvedValue({}),
      };
    }
  };
});

describe('recordPlaybackEventUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCtx = createAppContext({ type: 'guest' });

  it('returns PlaybackAccessDeniedError when access is denied', async () => {
    (checkVideoAccess as any).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' }
    });

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'PLAY_STARTED',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1'
    }, mockCtx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error).toBeInstanceOf(PlaybackAccessDeniedError);
        expect(result.error.statusCode).toBe(403);
        expect(result.error.code).toBe('ACCESS_DENIED');
        expect(result.error.message).toBe('PATRON_REQUIRED');
    }
  });

  it('allows access error even if access is denied', async () => {
    (checkVideoAccess as any).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: 'PATRON_REQUIRED' }
    });

    const result = await recordPlaybackEventUseCase({
      videoId: 'v1',
      type: 'ACCESS_ERROR',
      ipHash: 'ip1',
      uaHash: 'ua1',
      fingerprint: 'f1'
    }, mockCtx);

    expect(result.ok).toBe(true);
  });
});
