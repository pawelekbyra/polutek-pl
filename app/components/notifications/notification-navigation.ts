import { clearCommentDeepLink, requestCommentDeepLink } from "../comments/deep-link";

export const NOTIFICATION_NAVIGATE_EVENT = "polutek:navigate-notification";
export type NotificationNavigationDetail = { href: string };

/** Home can claim known videos and switch them in place. Other destinations use the client router. */
export function navigateNotification(href: string, router: { push: (href: string, options?: { scroll?: boolean }) => void }): void {
  const url = new URL(href, window.location.origin);
  const commentId = /^#comment-([A-Za-z0-9-]+)$/.exec(url.hash)?.[1];
  if (commentId) requestCommentDeepLink(commentId); else clearCommentDeepLink();
  const event = new CustomEvent<NotificationNavigationDetail>(NOTIFICATION_NAVIGATE_EVENT, { detail: { href }, cancelable: true });
  if (window.dispatchEvent(event)) router.push(href, { scroll: !commentId });
}

export function notificationVideoTarget(href: string): { slug: string; commentId?: string } | null {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const watch = /^\/(?:[a-z]{2}\/)?watch\/([^/]+)\/?$/.exec(url.pathname);
    const home = /^\/(?:en|de|es|fr|it|pt|zh)?\/?$/.test(url.pathname);
    const slug = watch ? decodeURIComponent(watch[1]) : home ? url.searchParams.get("v") : null;
    return slug ? { slug, commentId: /^#comment-([A-Za-z0-9-]+)$/.exec(url.hash)?.[1] } : null;
  } catch { return null; }
}
