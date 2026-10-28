"use client";
import { useSyncExternalStore } from "react";
import { commentDeepLinkRevision, subscribeCommentDeepLink } from "./deep-link";
const serverRevision = () => 0;
export function useCommentDeepLinkRevision() {
  return useSyncExternalStore(subscribeCommentDeepLink, commentDeepLinkRevision, serverRevision);
}
