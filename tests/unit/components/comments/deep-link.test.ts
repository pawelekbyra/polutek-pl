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

describe('comment deep link captured by the head script', () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('the inline script writes the target down, and the module reads it after the address was collapsed', async () => {
    window.location.hash = '#comment-abc-123';
    const { COMMENT_DEEP_LINK_CAPTURE_SCRIPT } = await import('@/app/components/comments/deep-link');
    new Function(COMMENT_DEEP_LINK_CAPTURE_SCRIPT)();
    window.history.replaceState(null, '', '/'); // UrlMask
    vi.resetModules();
    const mod = await import('@/app/components/comments/deep-link');
    expect(mod.pendingCommentDeepLink()).toBe('abc-123');
    expect(mod.openedWithCommentDeepLink()).toBe(true);
    expect(mod.consumeCommentDeepLink('abc-123')).toBe(true);
    expect(window.sessionStorage.getItem('pp:comment-target')).toBeNull();
  });

  it('ignores a stored target that is a leftover from an earlier visit', async () => {
    window.sessionStorage.setItem('pp:comment-target', `old-one|${Date.now() - 5 * 60_000}`);
    const mod = await import('@/app/components/comments/deep-link');
    expect(mod.pendingCommentDeepLink()).toBeNull();
    expect(mod.openedWithCommentDeepLink()).toBe(false);
  });
});
