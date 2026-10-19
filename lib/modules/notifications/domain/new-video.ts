import { getLocalizedHref } from "@/lib/i18n/routing";

/**
 * New-video notification (kind NEW_VIDEO): who gets it is decided by the fan-out use case, this file
 * holds the pure parts: copy, link and the lock key. No I/O.
 */

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

/** Default text of the premiere notification (the moment the scheduled premiere starts). */
export function buildPremiereCopy(input: NewVideoCopyInput): NewVideoCopy {
  const channel = clip(input.channelName, 80);
  const title = clip(input.title, 200);
  const titleEn = clip(input.titleEn?.trim() ? input.titleEn : input.title, 200);
  return {
    titlePl: `Premiera: ${title}`,
    titleEn: `Premiere: ${titleEn}`,
    bodyPl: `Film właśnie się zaczął na kanale ${channel}`,
    bodyEn: `The video just premiered on ${channel}`,
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
