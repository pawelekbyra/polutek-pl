import type { CommentView } from "../types";

/** A new comment goes right below the pinned one(s): the pinned comment always stays on top (as the server orders it). */
export function insertBelowPinned(list: CommentView[], comment: CommentView): CommentView[] {
  const firstUnpinned = list.findIndex((c) => !c.isPinned);
  const at = firstUnpinned === -1 ? list.length : firstUnpinned;
  return [...list.slice(0, at), comment, ...list.slice(at)];
}

/** Pinned comments first, the rest keeps its order. */
export function pinnedFirst(list: CommentView[]): CommentView[] {
  return [...list.filter((c) => c.isPinned), ...list.filter((c) => !c.isPinned)];
}
