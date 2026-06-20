import { describe, expect, it } from 'vitest';
import {
  buildCreatedVideoUploadUrl,
  resolveInitialVideoDetailsTab,
} from '@/app/admin/videos/[id]/details-tab-state';

describe('admin video create media tab flow contract', () => {
  it('builds a post-create URL that opens the media tab and anchors the media section', () => {
    const uploadUrl = buildCreatedVideoUploadUrl('abc123');

    expect(uploadUrl).toBe('/admin/videos/abc123?tab=media#media');
    expect(resolveInitialVideoDetailsTab('?tab=media', '#media')).toBe('media');
  });
});
