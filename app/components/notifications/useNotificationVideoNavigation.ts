"use client";
import { useEffect } from "react";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { withRealUrl } from "@/lib/i18n/real-location";
import { VIDEO_HISTORY_STATE_KEY } from "../channel/home-history";
import { NOTIFICATION_NAVIGATE_EVENT, notificationVideoTarget, type NotificationNavigationDetail } from "./notification-navigation";

export const NOTIFICATION_COMMENT_HISTORY_KEY = "polutekCommentId";
type Video = { id: string; slug: string | null };
type Options = { videos: Array<Video | null | undefined>; language: Locale; onSelect: (id: string, comment: boolean) => void };

export function useNotificationVideoNavigation(options: Options) {
  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<NotificationNavigationDetail>).detail;
      const target = detail && notificationVideoTarget(detail.href);
      if (!target) return;
      const { videos, language, onSelect } = options;
      const video = videos.find((item) => item && (item.id === target.slug || item.slug === target.slug));
      if (!video) return;
      event.preventDefault();
      onSelect(video.id, Boolean(target.commentId));
      const hash = target.commentId ? `#comment-${target.commentId}` : "";
      const pathname = getLocalizedHref(language, "home");
      const search = `?v=${encodeURIComponent(video.slug || video.id)}`;
      window.history.pushState(withRealUrl({ ...window.history.state, [VIDEO_HISTORY_STATE_KEY]: video.id, [NOTIFICATION_COMMENT_HISTORY_KEY]: target.commentId }, { pathname, search }), "", `${pathname}${search}${hash}`);
    };
    window.addEventListener(NOTIFICATION_NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(NOTIFICATION_NAVIGATE_EVENT, onNavigate);
  }, [options]);
}
