/**
 * What a video's status means to viewers (CLAUDE.md 4.4, "Widoczność filmu"). Pure and dependency-free, so the
 * server queries, the Studio form and the tests share one definition.
 *
 *  - PUBLISHED: listed (home list, sidebar, channel page, search, sitemap, recommendations) and reachable by link.
 *  - UNLISTED:  reachable by link with the same tier rules as PUBLISHED, but never listed anywhere and never indexed.
 *  - DRAFT:     private, only the channel's members and staff.
 *  - ARCHIVED:  hidden from everybody except staff.
 *
 * Public *list* queries filter `status = PUBLISHED` (see `LISTED_VIDEO_STATUS`); only the by-link paths
 * (`checkVideoAccess`, `getPublicVideoByIdOrSlug`, thumbnails, reports) use `isLinkAccessibleStatus`.
 */
export const LISTED_VIDEO_STATUS = "PUBLISHED" as const;

/** Statuses a viewer with the link may open (subject to moderation, channel visibility and tier). */
export const LINK_ACCESSIBLE_VIDEO_STATUSES = ["PUBLISHED", "UNLISTED"] as const;

export function isLinkAccessibleStatus(status: string | null | undefined): boolean {
  return status === "PUBLISHED" || status === "UNLISTED";
}

/** True when the video may appear on lists, in search, in the sitemap and in recommendations. */
export function isListedStatus(status: string | null | undefined): boolean {
  return status === LISTED_VIDEO_STATUS;
}

/**
 * Adult content: declared by the creator (`isAdult`) or set by moderation (`AGE_RESTRICTED`). Both have the same
 * effect: only signed-in viewers may watch, and the video is left out of the sitemap and the structured data.
 */
export function isAdultVideo(video: { isAdult?: boolean | null; moderationStatus?: string | null }): boolean {
  return video.isAdult === true || video.moderationStatus === "AGE_RESTRICTED";
}

/** Search engines must not index an unlisted or an adult video's page. */
export function shouldNoIndexVideo(video: { status?: string | null; isAdult?: boolean | null; moderationStatus?: string | null } | null | undefined): boolean {
  if (!video) return false;
  return video.status === "UNLISTED" || isAdultVideo(video);
}

export type VideoStatusValue = "DRAFT" | "PUBLISHED" | "UNLISTED" | "ARCHIVED";

const TRANSITIONS: Record<VideoStatusValue, readonly VideoStatusValue[]> = {
  DRAFT: ["PUBLISHED", "UNLISTED", "ARCHIVED"],
  PUBLISHED: ["UNLISTED", "DRAFT", "ARCHIVED"],
  UNLISTED: ["PUBLISHED", "DRAFT", "ARCHIVED"],
  // An archived video comes back only as a draft ("restore"), then goes through the publication blockers again.
  ARCHIVED: ["DRAFT"],
};

/** Allowed manual status changes; entering PUBLISHED or UNLISTED additionally needs the publication blockers to be clear. */
export function isAllowedStatusTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = TRANSITIONS[from as VideoStatusValue];
  return Boolean(allowed && allowed.includes(to as VideoStatusValue));
}
