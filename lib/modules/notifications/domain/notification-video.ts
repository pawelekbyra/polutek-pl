import { isThumbnailProxyPath, parsePublicThumbnailUrl, resolvePublicThumbnailSrc, type MediaHostEnv } from "@/lib/modules/media";
import { isVideoPubliclyVisible } from "@/lib/modules/video";
import type { UserNotificationType } from "./user-notifications";

/**
 * The video a new-video / premiere notification points at, as far as the recipient may see it (pure).
 *
 * Only the small fields of the video row are read (no description, no HLS data). The cover is shown only
 * under the same rule the thumbnail route applies to the public (`isVideoPubliclyVisible`): due, not
 * removed by moderation, on a publicly visible channel. Beyond that the notification is stricter than the
 * route: only PUBLISHED. A video moved to UNLISTED, DRAFT or ARCHIVED after the announcement, or one that
 * does not exist any more, yields no preview at all, so the bell never confirms a hidden video. Access
 * tier (login, patron zone) is not checked, exactly as on the public lists: covers are public there too.
 */
export type NotificationVideoRow = {
  id: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
  moderationStatus: string | null;
  thumbnailUrl: string;
  thumbnailPublicUrl: string | null;
  creator: { status: string; deletedAt: Date | null } | null;
};

export type NotificationVideoPreview = { videoId: string; videoSlug: string; thumbnailUrl: string };

/** Notification types that carry a video cover (comments under a video do not: they are about a comment). */
const VIDEO_NOTIFICATION_TYPES: readonly UserNotificationType[] = ["new_video", "premiere"];

export function notificationTypeHasVideo(type: UserNotificationType): boolean {
  return VIDEO_NOTIFICATION_TYPES.includes(type);
}

export function notificationVideoPreview(row: NotificationVideoRow | undefined | null, now: Date, env: MediaHostEnv): NotificationVideoPreview | null {
  if (!row || row.status !== "PUBLISHED") return null;
  if (!isVideoPubliclyVisible(row, now)) return null;
  const src = resolvePublicThumbnailSrc({ id: row.id, status: row.status, thumbnailUrl: row.thumbnailUrl, thumbnailPublicUrl: row.thumbnailPublicUrl }, env);
  // Belt and braces: only our own proxy path or the public thumbnail host ever reaches the client.
  if (!isThumbnailProxyPath(src) && parsePublicThumbnailUrl(src, env) === null) return null;
  return { videoId: row.id, videoSlug: row.slug, thumbnailUrl: src };
}
