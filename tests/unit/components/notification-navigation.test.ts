/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateNotification, notificationVideoTarget, NOTIFICATION_NAVIGATE_EVENT } from '@/app/components/notifications/notification-navigation';
import { clearCommentDeepLink, consumeCommentDeepLink, pendingCommentDeepLink, requestCommentDeepLink, commentDeepLinkRevision } from '@/app/components/comments/deep-link';

beforeEach(() => clearCommentDeepLink());
describe('notification navigation', () => {
  it('parses localized watch and home links, without confusing another page or origin for the current channel', () => {
    expect(notificationVideoTarget('/en/watch/a%20b#comment-c1')).toEqual({ slug: 'a b', commentId: 'c1' });
    expect(notificationVideoTarget('/?v=first')).toMatchObject({ slug: 'first' });
    expect(notificationVideoTarget('/search?v=first')).toBeNull();
    expect(notificationVideoTarget('https://elsewhere.example/watch/first')).toBeNull();
  });
  it('lets the video shell claim navigation before falling back to the client router', () => {
    const router = { push: vi.fn() };
    const claim = (event: Event) => event.preventDefault();
    window.addEventListener(NOTIFICATION_NAVIGATE_EVENT, claim);
    navigateNotification('/watch/first#comment-c1', router);
    window.removeEventListener(NOTIFICATION_NAVIGATE_EVENT, claim);
    expect(router.push).not.toHaveBeenCalled();
    expect(pendingCommentDeepLink()).toBe('c1');
    navigateNotification('/en/watch/unknown#comment-c2', router);
    expect(router.push).toHaveBeenCalledWith('/en/watch/unknown#comment-c2', { scroll: false });
    expect(pendingCommentDeepLink()).toBe('c2');
  });
  it('allows the same mounted comment to be targeted and consumed repeatedly', () => {
    const revision = commentDeepLinkRevision();
    requestCommentDeepLink('c1'); expect(consumeCommentDeepLink('c1')).toBe(true);
    requestCommentDeepLink('c1'); expect(consumeCommentDeepLink('c1')).toBe(true);
    expect(commentDeepLinkRevision()).toBe(revision + 2);
  });
});

it('clears a previous failed comment target when following an ordinary notification', () => {
  requestCommentDeepLink('old-comment');
  navigateNotification('/watch/new-video', { push: vi.fn() });
  expect(pendingCommentDeepLink()).toBeNull();
});
