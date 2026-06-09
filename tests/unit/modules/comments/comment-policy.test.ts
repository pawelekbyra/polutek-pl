import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { Actor } from '@/lib/modules/shared/actor';
import { AccessDecisionDto } from '@/lib/modules/access';

describe('CommentPolicy Boundary', () => {
  const guest: Actor = { type: 'guest' };
  const user: Actor = { type: 'user', userId: 'u1', isPatron: false };
  const admin: Actor = { type: 'admin', userId: 'a1' };

  const accessAllowed: AccessDecisionDto = { hasAccess: true };
  const accessDeniedPatron: AccessDecisionDto = { hasAccess: false, reason: 'PATRON_REQUIRED' };
  const accessDeniedLogin: AccessDecisionDto = { hasAccess: false, reason: 'LOGIN_REQUIRED' };

  describe('canReactToVideo', () => {
    it('denies guest even if video is public', () => {
      expect(CommentPolicy.canReactToVideo(guest, accessAllowed)).toBe(false);
    });

    it('allows user if video access is allowed', () => {
      expect(CommentPolicy.canReactToVideo(user, accessAllowed)).toBe(true);
    });

    it('denies user if video access is denied', () => {
      expect(CommentPolicy.canReactToVideo(user, accessDeniedPatron)).toBe(false);
    });

    it('allows admin if video access is allowed', () => {
      expect(CommentPolicy.canReactToVideo(admin, accessAllowed)).toBe(true);
    });
  });

  describe('canUpdateComment', () => {
    it('allows owner', () => {
      expect(CommentPolicy.canUpdateComment(user, 'u1')).toBe(true);
    });

    it('denies non-owner', () => {
      expect(CommentPolicy.canUpdateComment(user, 'other')).toBe(false);
    });

    it('allows admin', () => {
      expect(CommentPolicy.canUpdateComment(admin, 'u1')).toBe(true);
    });
  });
});
