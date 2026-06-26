import { describe, expect, it } from 'vitest';
import { AccessTier, VideoStatus } from '@prisma/client';
import { buildAdminVideoUpdatePayload } from '@/lib/modules/video';

describe('admin video update payload', () => {
  it('drops read-only engagement counters from ordinary metadata saves', () => {
    const payload = buildAdminVideoUpdatePayload({
      id: 'video-1',
      title: 'Updated title',
      views: 999,
      likesCount: 123,
      dislikesCount: 4,
      tier: AccessTier.PUBLIC,
      status: VideoStatus.PUBLISHED,
    });

    expect(payload).toEqual({
      id: 'video-1',
      title: 'Updated title',
      tier: AccessTier.PUBLIC,
      status: VideoStatus.PUBLISHED,
    });
    expect(payload).not.toHaveProperty('views');
    expect(payload).not.toHaveProperty('likesCount');
    expect(payload).not.toHaveProperty('dislikesCount');
  });

  it('only includes duration when the request explicitly owns duration', () => {
    expect(buildAdminVideoUpdatePayload({ id: 'video-1', title: 'Quick edit' })).not.toHaveProperty('duration');
    expect(buildAdminVideoUpdatePayload({ id: 'video-1', duration: '12:34' })).toMatchObject({
      id: 'video-1',
      duration: '12:34',
    });
  });
});
