/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('comment deep link', () => {
  beforeEach(() => vi.resetModules());

  it('remembers the #comment-... target at load, before the address bar is rewritten, and hands it out once', async () => {
    window.location.hash = '#comment-8c489bcc-9581-40eb-8d04-272b44716eb0';
    const mod = await import('@/app/components/comments/deep-link');
    window.history.replaceState(null, '', '/'); // what UrlMask does
    expect(window.location.hash).toBe('');
    expect(mod.pendingCommentDeepLink()).toBe('8c489bcc-9581-40eb-8d04-272b44716eb0');
    expect(mod.consumeCommentDeepLink('another-comment')).toBe(false);
    expect(mod.consumeCommentDeepLink('8c489bcc-9581-40eb-8d04-272b44716eb0')).toBe(true);
    expect(mod.consumeCommentDeepLink('8c489bcc-9581-40eb-8d04-272b44716eb0')).toBe(false);
  });

  it('has nothing pending for an ordinary address', async () => {
    window.history.replaceState(null, '', '/');
    const mod = await import('@/app/components/comments/deep-link');
    expect(mod.pendingCommentDeepLink()).toBeNull();
  });
});
