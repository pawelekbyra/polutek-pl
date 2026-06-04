import { describe, expect, it } from 'vitest';
import { AccessTier } from '@prisma/client';
import { getCommentAccessState, isPatronLikeUser } from '@/lib/access/comment-access';

describe('comment access state', () => {
  it('allows logged-in non-patrons to comment on PUBLIC videos', () => {
    expect(getCommentAccessState({ isPatron: false, role: 'USER', referralPoints: 0 }, AccessTier.PUBLIC).canComment).toBe(true);
  });

  it('allows logged-in non-patrons to comment on LOGGED_IN videos', () => {
    expect(getCommentAccessState({ isPatron: false, role: 'USER', referralPoints: 0 }, AccessTier.LOGGED_IN).canComment).toBe(true);
  });

  it('blocks guests from commenting even on PUBLIC videos', () => {
    expect(getCommentAccessState(null, AccessTier.PUBLIC).canComment).toBe(false);
  });

  it('requires patron-like status to comment on PATRON videos', () => {
    expect(getCommentAccessState({ isPatron: false, role: 'USER', referralPoints: 0 }, AccessTier.PATRON).canComment).toBe(false);
    expect(getCommentAccessState({ isPatron: true, role: 'USER', referralPoints: 0 }, AccessTier.PATRON).canComment).toBe(true);
    expect(getCommentAccessState({ isPatron: false, role: 'USER', referralPoints: 5 }, AccessTier.PATRON).canComment).toBe(false);
    expect(getCommentAccessState({ isPatron: false, role: 'ADMIN', referralPoints: 0 }, AccessTier.PATRON).canComment).toBe(true);
  });

  it('identifies patron-like users from isPatron or admin status only', () => {
    expect(isPatronLikeUser({ isPatron: true })).toBe(true);
    expect(isPatronLikeUser({ referralPoints: 5 })).toBe(false);
    expect(isPatronLikeUser({ role: 'ADMIN' })).toBe(true);
    expect(isPatronLikeUser({ isPatron: false, referralPoints: 4, role: 'USER' })).toBe(false);
  });
});
