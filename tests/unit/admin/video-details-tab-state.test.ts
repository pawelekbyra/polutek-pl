import { describe, expect, it } from 'vitest';
import {
  buildCreatedVideoUploadUrl,
  resolveInitialVideoDetailsTab,
} from '@/app/admin/videos/[id]/details-tab-state';

describe('video details tab state', () => {
  it.each([
    ['?tab=media', '', 'media'],
    ['', '#media', 'media'],
    ['?tab=media', '#media', 'media'],
    ['?tab=does-not-exist', '', 'summary'],
    ['', '', 'summary'],
    ['?tab=content', '#media', 'content'],
    ['?tab=invalid', '#media', 'media'],
  ])('resolves search=%s hash=%s to %s', (search, hash, expected) => {
    expect(resolveInitialVideoDetailsTab(search, hash)).toBe(expected);
  });

  it('builds the post-create upload URL contract', () => {
    expect(buildCreatedVideoUploadUrl('abc123')).toBe('/admin/videos/abc123?tab=media#media');
  });
});
