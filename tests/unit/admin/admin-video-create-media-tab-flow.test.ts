import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const listPage = readFileSync('app/admin/videos/page.tsx', 'utf8');
const detailsPage = readFileSync('app/admin/videos/[id]/page.tsx', 'utf8');

describe('admin video create media tab flow', () => {
  it('redirects newly-created drafts to the media tab URL contract', () => {
    expect(listPage).toContain('router.push(`/admin/videos/${data.id}?tab=media#media`);');
  });

  it('controls details tabs from tab query/hash so media upload is visible after redirect', () => {
    expect(detailsPage).toContain('const [activeTab, setActiveTab] = useState(getInitialDetailsTab);');
    expect(detailsPage).toContain('<Tabs value={activeTab} onValueChange={handleTabChange}');
    expect(detailsPage).toContain('new URLSearchParams(window.location.search).get("tab")');
    expect(detailsPage).toContain('window.location.hash.replace(/^#/, "")');
    expect(detailsPage).toContain('<TabsContent value="media" id="media"');
    expect(detailsPage).toContain('<VideoUploadSection');
  });
});
