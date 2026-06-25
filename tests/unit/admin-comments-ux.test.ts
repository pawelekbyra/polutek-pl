import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const adminCommentsPage = () => readFileSync('app/admin/comments/page.tsx', 'utf8');
const videoDetailsPage = () => readFileSync('app/admin/videos/[id]/page.tsx', 'utf8');

describe('admin comments UX slice', () => {
  it('debounces admin comments search before fetching the comments API', () => {
    const source = adminCommentsPage();

    expect(source).toContain('setDebouncedSearch(search)');
    expect(source).toContain('}, 400);');
    expect(source).toContain('searchOverride ?? debouncedSearch');
    expect(source).toContain('/api/admin/comments?${params.toString()}');
  });

  it('links video details comments to full moderation filtered by video', () => {
    const source = videoDetailsPage();

    expect(source).toContain('href={`/admin/comments?videoId=${encodeURIComponent(video.id)}`}');
    expect(source).toContain('Pokaż wszystkie w moderacji');
    expect(source).not.toContain('Pełna moderacja wkrótce');
  });
});
