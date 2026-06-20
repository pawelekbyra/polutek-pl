import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCreatedVideoUploadUrl } from '@/app/admin/videos/[id]/details-tab-state';

const listPage = readFileSync('app/admin/videos/page.tsx', 'utf8');
const detailsPage = readFileSync('app/admin/videos/[id]/page.tsx', 'utf8');

describe('admin video create media tab flow contract', () => {
  it('uses the shared post-create upload URL helper', () => {
    expect(buildCreatedVideoUploadUrl('abc123')).toBe('/admin/videos/abc123?tab=media#media');
    expect(listPage).toContain('router.push(buildCreatedVideoUploadUrl(data.id));');
  });

  it('keeps details tabs controlled from the pure tab resolver and exposes the media upload section', () => {
    expect(detailsPage).toContain('resolveInitialVideoDetailsTab(window.location.search, window.location.hash)');
    expect(detailsPage).toContain('<Tabs value={activeTab} onValueChange={handleTabChange}');
    expect(detailsPage).toContain('<TabsContent value="media" id="media"');
    expect(detailsPage).toContain('<VideoUploadSection');
  });
});
