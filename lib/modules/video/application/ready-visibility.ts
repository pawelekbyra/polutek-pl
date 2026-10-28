import type { AppContext } from "@/lib/modules/shared/app-context";

/**
 * What a video becomes when it publishes itself after processing ("publish when ready"): PUBLISHED or UNLISTED.
 * The choice is stored in `Video.publishAfterAssetReadyVisibility`, written in the same statement/transaction as the
 * flag `publishAfterAssetReady`. NULL means "unknown" and never means PUBLISHED: the auto-publication then stops.
 *
 * Legacy: before that column existed the choice lived in a loose `AppSetting` row (`video_ready_visibility:<id>`,
 * present only for UNLISTED). Pending jobs created in that format are still honoured by `resolveReadyVisibility`
 * (an UNLISTED row wins); the row is deleted when the auto-publication ends.
 */
export type ReadyVisibility = "PUBLISHED" | "UNLISTED";

export function readyVisibilityKey(videoId: string): string {
  return `video_ready_visibility:${videoId}`;
}

/** Strict: anything other than the two known values is `null` (unknown), never PUBLISHED. */
export function parseReadyVisibility(value: string | null | undefined): ReadyVisibility | null {
  return value === "UNLISTED" || value === "PUBLISHED" ? value : null;
}

/**
 * Target visibility of a pending auto-publication, or `null` when it cannot be determined. Throws when the legacy
 * lookup fails (callers must treat that as "do not publish now").
 */
export async function resolveReadyVisibility(
  video: { id: string; publishAfterAssetReadyVisibility?: string | null },
  ctx: Pick<AppContext, "prisma">,
): Promise<ReadyVisibility | null> {
  const typed = parseReadyVisibility(video.publishAfterAssetReadyVisibility);
  if (typed) return typed;
  const row = await ctx.prisma.appSetting.findUnique({ where: { key: readyVisibilityKey(video.id) }, select: { value: true } });
  return row?.value === "UNLISTED" ? "UNLISTED" : null;
}

/** Removes the legacy AppSetting row. Best effort: never throws (the typed column is the source of truth). */
export async function clearReadyVisibility(videoId: string, ctx: Pick<AppContext, "prisma">): Promise<void> {
  try {
    await ctx.prisma.appSetting.deleteMany({ where: { key: readyVisibilityKey(videoId) } });
  } catch {
    // A stale legacy row is harmless: it is only read while the typed column is NULL and the flag is pending.
  }
}
