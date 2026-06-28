import { describe, it, expect } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';

describe('Actor & AppContext', () => {
  it('should support guest actor', () => {
    const ctx = createAppContext({ actor: { type: 'guest' } });
    expect(ctx.actor.type).toBe('guest');
  });

  it('should support user actor', () => {
    const ctx = createAppContext({ actor: { type: 'user', userId: 'u1' } });
    expect(ctx.actor.type).toBe('user');
    if (ctx.actor.type === 'user') {
      expect(ctx.actor.userId).toBe('u1');
    }
  });

  it('should support admin actor', () => {
    const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' } });
    expect(ctx.actor.type).toBe('admin');
    if (ctx.actor.type === 'admin') {
      expect(ctx.actor.userId).toBe('a1');
    }
  });

  it('should support system actor', () => {
    const ctx = createAppContext({ actor: { type: 'system', reason: 'task' } });
    expect(ctx.actor.type).toBe('system');
    if (ctx.actor.type === 'system') {
      expect(ctx.actor.reason).toBe('task');
    }
  });

  it('should not have userId or role in AppContext anymore', () => {
    const ctx = createAppContext({ actor: { type: 'admin', userId: 'a1' } });
    expect((ctx as any).userId).toBeUndefined();
    expect((ctx as any).role).toBeUndefined();
  });

  it('should strip userId and role if passed in overrides', () => {
    const ctx = createAppContext({
      actor: { type: 'user', userId: 'u1' },
      userId: 'legacy-id',
      role: 'legacy-role'
    } as any);
    expect((ctx as any).userId).toBeUndefined();
    expect((ctx as any).role).toBeUndefined();
    expect(ctx.actor.type).toBe('user');
  });
});
