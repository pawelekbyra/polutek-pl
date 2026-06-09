import { describe, it, expect, vi } from 'vitest';
import { CommentPolicy } from '@/lib/modules/comments/domain/comment.policy';
import { Actor } from '@/lib/modules/shared/actor';

describe('CommentPolicy', () => {
  const guest: Actor = { type: 'guest' };
  const user: Actor = { type: 'user', userId: 'user-1', isPatron: false };
  const patron: Actor = { type: 'user', userId: 'patron-1', isPatron: true };
  const admin: Actor = { type: 'admin', userId: 'admin-1' };

  describe('canCreate', () => {
    it('should allow admin to comment anywhere', () => {
      expect(CommentPolicy.canCreate(admin, { hasAccess: true })).toBe(true);
      expect(CommentPolicy.canCreate(admin, { hasAccess: false })).toBe(true);
    });

    it('should block guest from commenting', () => {
      expect(CommentPolicy.canCreate(guest, { hasAccess: true })).toBe(false);
    });

    it('should allow user with access to comment', () => {
      expect(CommentPolicy.canCreate(user, { hasAccess: true })).toBe(true);
    });

    it('should block user without access (non-patron on patron-only video)', () => {
      expect(CommentPolicy.canCreate(user, { hasAccess: false })).toBe(false);
    });

    it('should allow patron with access to comment', () => {
      expect(CommentPolicy.canCreate(patron, { hasAccess: true })).toBe(true);
    });
  });

  describe('canReact', () => {
    it('should allow admin to react anywhere', () => {
      expect(CommentPolicy.canReact(admin, { hasAccess: true })).toBe(true);
      expect(CommentPolicy.canReact(admin, { hasAccess: false })).toBe(true);
    });

    it('should block guest from reacting', () => {
      expect(CommentPolicy.canReact(guest, { hasAccess: true })).toBe(false);
    });

    it('should block user without access (non-patron on patron-only video)', () => {
      expect(CommentPolicy.canReact(user, { hasAccess: false })).toBe(false);
    });

    it('should allow user with access to react', () => {
      expect(CommentPolicy.canReact(user, { hasAccess: true })).toBe(true);
    });
  });

  describe('canUpdate', () => {
    it('should allow author to update own comment', () => {
      expect(CommentPolicy.canUpdate(user, 'user-1')).toBe(true);
    });

    it('should block user from updating others comments', () => {
      expect(CommentPolicy.canUpdate(user, 'other-user')).toBe(false);
    });

    it('should block guest from updating', () => {
      expect(CommentPolicy.canUpdate(guest, 'any-id')).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('should allow author to delete own comment', () => {
      expect(CommentPolicy.canDelete(user, 'user-1')).toBe(true);
    });

    it('should allow admin to delete any comment', () => {
      expect(CommentPolicy.canDelete(admin, 'other-user')).toBe(true);
    });

    it('should block user from deleting others comments', () => {
      expect(CommentPolicy.canDelete(user, 'other-user')).toBe(false);
    });
  });
});
