import { describe, expect, it } from 'vitest';
import { buildAdminVideoUpdatePayload, INITIAL_FORM_DATA } from '@/app/admin/videos/components/video-utils';

describe('admin video update payload', () => {
  it('omits counters and unknown quick-edit duration from normal list updates', () => {
    const payload = buildAdminVideoUpdatePayload({
      ...INITIAL_FORM_DATA,
      id: 'video-1',
      title: '  Title  ',
      slug: '  title  ',
      duration: '',
      views: 123,
      likesCount: 45,
      dislikesCount: 6,
    });

    expect(payload).not.toHaveProperty('views');
    expect(payload).not.toHaveProperty('likesCount');
    expect(payload).not.toHaveProperty('dislikesCount');
    expect(payload).not.toHaveProperty('duration');
    expect(payload.title).toBe('Title');
    expect(payload.slug).toBe('title');
  });

  it('keeps duration as an explicit full-edit field', () => {
    expect(buildAdminVideoUpdatePayload({ ...INITIAL_FORM_DATA, duration: ' 12:34 ' }, { includeDuration: true })).toMatchObject({ duration: '12:34' });
    expect(buildAdminVideoUpdatePayload({ ...INITIAL_FORM_DATA, duration: '' }, { includeDuration: true })).toMatchObject({ duration: null });
  });
});
