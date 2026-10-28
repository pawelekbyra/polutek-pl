import { describe, expect, it } from 'vitest';
import { includeCommentContext, uniqueComments } from '@/app/components/comments/hooks/useCommentDeepLinkContext';
import type { CommentView } from '@/app/components/comments/types';
const comment = (id: string, parentId: string | null = null) => ({ id, parentId, repliesPreview: [], repliesCount: 2 }) as unknown as CommentView;
describe('targeted comment context', () => {
  it('inserts an old thread and its precise reply without loading unrelated pages or changing total count', () => {
    const data = { pages: [{ comments: [comment('new')], totalCount: 1000, nextCursor: 'keep' }], pageParams: [''] };
    const next = includeCommentContext(data, { videoId: 'v', comment: comment('reply', 'parent'), parentComment: comment('parent') });
    expect(next!.pages[0].comments.map((c) => c.id)).toEqual(['parent', 'new']);
    expect(next!.pages[0].comments[0].repliesPreview[0].id).toBe('reply');
    expect(next!.pages[0]).toMatchObject({ totalCount: 1000, nextCursor: 'keep' });
    expect(data.pages[0].comments).toHaveLength(1);
  });
  it('merges a reply into an existing parent and deduplicates a root when ordinary pagination reaches it', () => {
    const parent = { ...comment('parent'), repliesPreview: [comment('r0', 'parent')] };
    const next = includeCommentContext({ pages: [{ comments: [parent] }], pageParams: [''] }, { videoId: 'v', comment: comment('r1', 'parent'), parentComment: comment('parent') });
    expect(next!.pages[0].comments[0].repliesPreview.map((r) => r.id)).toEqual(['r0', 'r1']);
    expect(uniqueComments([next!.pages[0].comments[0], comment('parent')])).toHaveLength(1);
  });
});
