import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { Actor } from '@/lib/modules/shared/actor';
import { AccessDecisionDto } from '@/lib/modules/access';
import { CommentStatus } from '@prisma/client';

describe('CommentPolicy Boundary', () => {
  const guest: Actor = { type: 'guest' };
  const user: Actor = { type: 'user', userId: 'u1' };
  const admin: Actor = { type: 'admin', userId: 'a1' };

  const accessAllowed: AccessDecisionDto = { hasAccess: true };
  const accessDeniedPatron: AccessDecisionDto = { hasAccess: false, reason: 'LOGIN_REQUIRED' };
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

  describe('canReactToComment', () => {
    it('denies guest even if video is public', () => {
      expect(CommentPolicy.canReactToComment(guest, accessAllowed)).toBe(false);
    });

    it('allows user if video access is allowed', () => {
      expect(CommentPolicy.canReactToComment(user, accessAllowed)).toBe(true);
    });

    it('denies user if video access is denied', () => {
      expect(CommentPolicy.canReactToComment(user, accessDeniedPatron)).toBe(false);
    });

    it('allows admin if video access is allowed', () => {
      expect(CommentPolicy.canReactToComment(admin, accessAllowed)).toBe(true);
    });
  });

  describe('canReportComment', () => {
    it('denies guest even if video is public', () => {
      expect(CommentPolicy.canReportComment(guest, accessAllowed)).toBe(false);
    });

    it('denies user if video access is denied', () => {
      expect(CommentPolicy.canReportComment(user, accessDeniedPatron)).toBe(false);
    });

    it('allows user if video access is allowed', () => {
      expect(CommentPolicy.canReportComment(user, accessAllowed)).toBe(true);
    });
  });

  describe('canUpdateComment', () => {
    it('allows owner', () => {
      expect(CommentPolicy.canUpdateComment(user, 'u1')).toBe(true);
    });

    it('denies non-owner', () => {
      expect(CommentPolicy.canUpdateComment(user, 'other')).toBe(false);
    });

    it("denies an admin editing someone else's comment (moderation hides or deletes instead)", () => {
      expect(CommentPolicy.canUpdateComment(admin, 'u1')).toBe(false);
    });

    it('allows an admin to edit their own comment', () => {
      expect(CommentPolicy.canUpdateComment(admin, 'a1')).toBe(true);
    });
  });

  describe('moderation state machine', () => {
    it('restores only what moderation hid or held, never a deleted comment', () => {
      expect(CommentPolicy.canTransition('restore', CommentStatus.HIDDEN)).toBe(true);
      expect(CommentPolicy.canTransition('restore', CommentStatus.HELD_FOR_REVIEW)).toBe(true);
      expect(CommentPolicy.canTransition('restore', CommentStatus.DELETED)).toBe(false);
    });

    it.each(['hide', 'hold', 'approve', 'restore', 'delete'] as const)('treats DELETED as final for "%s"', (action) => {
      expect(CommentPolicy.canTransition(action, CommentStatus.DELETED)).toBe(false);
    });
  });
});
