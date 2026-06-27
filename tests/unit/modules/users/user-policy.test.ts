import { describe, it, expect } from 'vitest';
import { UserPolicy } from '@/lib/modules/users/domain/user.policy';
import { Actor } from '@/lib/modules/shared/actor';

describe('UserPolicy.canSeeProfile', () => {
  const deletedUser = { id: 'u1', isDeleted: true };
  const activeUser = { id: 'u2', isDeleted: false };

  it('guest cannot see deleted user', () => {
    const actor: Actor = { type: 'guest' };
    expect(UserPolicy.canSeeProfile(actor, deletedUser)).toBe(false);
  });

  it('regular user cannot see deleted user', () => {
    const actor: Actor = { type: 'user', userId: 'u3' };
    expect(UserPolicy.canSeeProfile(actor, deletedUser)).toBe(false);
  });

  it('admin can see deleted user', () => {
    const actor: Actor = { type: 'admin', userId: 'u4' };
    expect(UserPolicy.canSeeProfile(actor, deletedUser)).toBe(true);
  });

  it('guest can see active user', () => {
    const actor: Actor = { type: 'guest' };
    expect(UserPolicy.canSeeProfile(actor, activeUser)).toBe(true);
  });

  it('regular user can see active user', () => {
    const actor: Actor = { type: 'user', userId: 'u3' };
    expect(UserPolicy.canSeeProfile(actor, activeUser)).toBe(true);
  });
});
