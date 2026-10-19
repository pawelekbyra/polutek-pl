/**
 * Comment deep links (`...#comment-<id>`, the target of a "someone replied" notification).
 *
 * UrlMask collapses the address bar to `/` right after the page mounts, which also drops the `#comment-...` part:
 * by the time the comments are on screen `location.hash` is empty and the page stays at the top. This module is
 * evaluated with the client bundle, before any effect runs, so it still sees the original address and remembers the
 * target until a comment with that id has been scrolled to.
 */

const HASH_PATTERN = /^#comment-([A-Za-z0-9-]+)$/;

function readHash(): string | null {
  if (typeof window === "undefined") return null;
  return HASH_PATTERN.exec(window.location.hash)?.[1] ?? null;
}

let pendingId: string | null = readHash();

if (typeof window !== "undefined") {
  // A link followed on the same document (no reload) arrives as a hash change.
  window.addEventListener("hashchange", () => {
    pendingId = readHash() ?? pendingId;
  });
}

export function pendingCommentDeepLink(): string | null {
  return pendingId;
}

/** True once, for the comment the link points at; the caller scrolls to it. */
export function consumeCommentDeepLink(commentId: string): boolean {
  if (pendingId !== commentId) return false;
  pendingId = null;
  return true;
}

export function clearCommentDeepLink(): void {
  pendingId = null;
}
