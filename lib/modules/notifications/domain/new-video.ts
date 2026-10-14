import { getLocalizedHref } from "@/lib/i18n/routing";

/**
 * New-video notification (kind NEW_VIDEO): who gets it is decided by the fan-out use case, this file
 * holds the pure parts: copy, link and the idempotency keys. No I/O.
 */

/** `AppSetting` key prefix of the "this video was fanned out" marker (value: ISO time). */
export const NEW_VIDEO_MARKER_PREFIX = "new-video-fanout:";

/**
 * `AppSetting` key holding the moment the sweep first ran. Videos that became public before it are
 * never notified (no back-fill of the catalogue when the feature is deployed).
 */
export const NEW_VIDEO_SWEEP_SINCE_KEY = "new-video-fanout-since";

/** Videos older than this (since publication or premiere) are never swept, whatever the marker says. */
export const NEW_VIDEO_SWEEP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function newVideoMarkerKey(videoId: string): string {
  return `${NEW_VIDEO_MARKER_PREFIX}${videoId}`;
}

/** Advisory-lock key serialising two fan-outs of the same video. */
export function newVideoLockKey(videoId: string): string {
  return `new-video-fanout-lock:${videoId}`;
}

/** In-site link stored on the notification; the bell localizes it for the viewer's language. */
export function newVideoHref(slug: string): string {
  return getLocalizedHref("pl", "watch", { slug });
}

export type NewVideoCopyInput = {
  channelName: string;
  title: string;
  titleEn?: string | null;
};

export type NewVideoCopy = { titlePl: string; titleEn: string; bodyPl: string; bodyEn: string };

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Default text: the headline names the channel, the body names the video. */
export function buildNewVideoCopy(input: NewVideoCopyInput): NewVideoCopy {
  const channel = clip(input.channelName, 80);
  const title = clip(input.title, 200);
  const titleEn = clip(input.titleEn?.trim() ? input.titleEn : input.title, 200);
  return {
    titlePl: `Nowy film: ${channel}`,
    titleEn: `New video: ${channel}`,
    bodyPl: title,
    bodyEn: titleEn,
  };
}

/**
 * An admin override (NotificationTemplate NEW_VIDEO) is static text with two optional placeholders,
 * `{{channelName}}` and `{{videoTitle}}`; without them it would lose the one thing worth saying.
 * Empty override fields fall back to the default text.
 */
export function applyNewVideoTemplate(
  override: { titlePl: string; titleEn: string; bodyPl: string; bodyEn: string } | null,
  defaults: NewVideoCopy,
  input: NewVideoCopyInput,
): NewVideoCopy {
  if (!override) return defaults;
  const channel = clip(input.channelName, 80);
  const titlePl = clip(input.title, 200);
  const titleEn = clip(input.titleEn?.trim() ? input.titleEn : input.title, 200);
  const fill = (text: string, videoTitle: string) =>
    text.replace(/\{\{\s*channelName\s*\}\}/g, channel).replace(/\{\{\s*videoTitle\s*\}\}/g, videoTitle);
  return {
    titlePl: fill(override.titlePl, titlePl).trim() || defaults.titlePl,
    titleEn: fill(override.titleEn, titleEn).trim() || defaults.titleEn,
    bodyPl: fill(override.bodyPl, titlePl).trim() || defaults.bodyPl,
    bodyEn: fill(override.bodyEn, titleEn).trim() || defaults.bodyEn,
  };
}
