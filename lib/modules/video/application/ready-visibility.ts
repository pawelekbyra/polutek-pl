import type { AppContext } from "@/lib/modules/shared/app-context";

/**
 * What a video becomes when it publishes itself after processing ("publish when ready"): PUBLISHED (default) or
 * UNLISTED. The video table has no column for it (the flag `publishAfterAssetReady` only says "do it"), so the
 * choice is kept as a small per-video setting that lives only while the auto-publication is pending and is removed
 * when it completes, is cancelled or the video is deleted. A missing or unknown value means PUBLISHED.
 */
export type ReadyVisibility = "PUBLISHED" | "UNLISTED";

export function readyVisibilityKey(videoId: string): string {
  return `video_ready_visibility:${videoId}`;
}

export function parseReadyVisibility(value: string | null | undefined): ReadyVisibility {
  return value === "UNLISTED" ? "UNLISTED" : "PUBLISHED";
}

export async function getReadyVisibility(videoId: string, ctx: Pick<AppContext, "prisma">): Promise<ReadyVisibility> {
  const row = await ctx.prisma.appSetting.findUnique({ where: { key: readyVisibilityKey(videoId) }, select: { value: true } });
  return parseReadyVisibility(row?.value);
}

/** `PUBLISHED` removes the setting (it is the default); `UNLISTED` stores it. Best effort: never throws. */
export async function setReadyVisibility(videoId: string, visibility: ReadyVisibility, ctx: Pick<AppContext, "prisma">): Promise<void> {
  const key = readyVisibilityKey(videoId);
  try {
    if (visibility === "PUBLISHED") {
      await ctx.prisma.appSetting.deleteMany({ where: { key } });
      return;
    }
    await ctx.prisma.appSetting.upsert({ where: { key }, create: { key, value: "UNLISTED" }, update: { value: "UNLISTED" } });
  } catch {
    // The video keeps the default (PUBLISHED on auto-publication would be wrong for UNLISTED, so callers that
    // need the value verify with getReadyVisibility before relying on it).
  }
}

export async function clearReadyVisibility(videoId: string, ctx: Pick<AppContext, "prisma">): Promise<void> {
  await setReadyVisibility(videoId, "PUBLISHED", ctx);
}
