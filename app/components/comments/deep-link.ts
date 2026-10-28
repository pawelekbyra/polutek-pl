/**
 * Comment deep links (`...#comment-<id>`, the target of a "someone replied" notification).
 *
 * Two things destroy the address before the comments are on screen: UrlMask collapses the address bar to `/` (the
 * `#comment-...` part goes with it) and, on a phone, ChannelHome scrolls the page to the player when it opens. So the
 * target is written down at the very first moment, by an inline script in the document head (it runs before any
 * bundle, so no import order or bundler tree-shaking can lose the race), into sessionStorage. This module reads it
 * from there (or from the address, when the script did not run) and hands it out once, to the comment it points at.
 */

const HASH_PATTERN = /^#comment-([A-Za-z0-9-]+)$/;
export const COMMENT_TARGET_STORAGE_KEY = "pp:comment-target";
/** A stored target older than this is a leftover from an earlier visit, not a link that was just followed. */
const STORED_TARGET_MAX_AGE_MS = 60_000;

/** Runs inline in <head>, before anything else: `id|timestamp` of the comment the address points at. */
export const COMMENT_DEEP_LINK_CAPTURE_SCRIPT = `try{var m=/^#comment-([A-Za-z0-9-]+)$/.exec(location.hash);if(m){sessionStorage.setItem(${JSON.stringify(
  COMMENT_TARGET_STORAGE_KEY,
)},m[1]+"|"+Date.now())}}catch(e){}`;

function readHash(): string | null {
  if (typeof window === "undefined") return null;
  return HASH_PATTERN.exec(window.location.hash)?.[1] ?? null;
}

function readStored(): string | null {
  try {
    const raw = window.sessionStorage.getItem(COMMENT_TARGET_STORAGE_KEY);
    if (!raw) return null;
    const [id, stamp] = raw.split("|");
    if (id && Date.now() - Number(stamp) < STORED_TARGET_MAX_AGE_MS && /^[A-Za-z0-9-]+$/.test(id)) return id;
    window.sessionStorage.removeItem(COMMENT_TARGET_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the address-based capture still works then.
  }
  return null;
}

function forgetStored() {
  try {
    window.sessionStorage.removeItem(COMMENT_TARGET_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

let pendingId: string | null = typeof window === "undefined" ? null : (readHash() ?? readStored());
const openedWithTarget = pendingId !== null;
let revision = 0;
const listeners = new Set<() => void>();
export const commentDeepLinkRevision = () => revision;
export function subscribeCommentDeepLink(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function requestCommentDeepLink(commentId: string): void {
  if (!/^[A-Za-z0-9-]+$/.test(commentId)) return;
  pendingId = commentId;
  try { window.sessionStorage.setItem(COMMENT_TARGET_STORAGE_KEY, `${commentId}|${Date.now()}`); } catch { /* Storage is optional. */ }
  revision++;
  listeners.forEach((listener) => listener());
}


if (typeof window !== "undefined") {
  // A link followed on the same document (no reload) arrives as a hash change.
  window.addEventListener("hashchange", () => {
    const target = readHash();
    if (target) requestCommentDeepLink(target);
  });
}

export function pendingCommentDeepLink(): string | null {
  return pendingId;
}

/** True when this page load came from a link to a comment (the page must not jump to the player then). */
export function openedWithCommentDeepLink(): boolean {
  return openedWithTarget;
}

/** True once, for the comment the link points at; the caller scrolls to it. */
export function consumeCommentDeepLink(commentId: string): boolean {
  if (pendingId !== commentId) return false;
  pendingId = null;
  forgetStored();
  return true;
}

export function clearCommentDeepLink(): void {
  pendingId = null;
  forgetStored();
}
