/**
 * Panel "Treści": reads and multi-step operations that the old panel kept in route handlers
 * (delete with R2 clean-up, channel layout). Every write still goes through the video and pipeline
 * use cases, so publication blockers, Hero rules, thumbnail sync and audit stay in one place.
 */
import type { AccessTier, VideoStatus } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import {
  deleteAdminVideo,
  getAdminVideoDetails,
  getAdminVideoList,
  reorderAdminVideos,
  updateAdminVideo,
  type AdminVideoDetailsDto,
  type AdminVideoDto,
} from "@/lib/modules/video";
import { getPipelineState, type PipelineStateDto } from "@/lib/modules/video-pipeline";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { R2ThumbnailStorageClient, captionObjectKey, parseCaptionRef, parsePublicThumbnailUrl } from "@/lib/modules/media";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { translationSubtitleUrls } from "@/lib/modules/translations";
import { thumbnailState, type ThumbnailState } from "../domain/thumbnail-state";
import { enqueueStorageCleanupInTx, kickStorageCleanup } from "./storage-cleanup-job";

export const CONTENT_PAGE_SIZE = 20;

export type ContentFilters = {
  q?: string;
  status?: "PUBLISHED" | "UNLISTED" | "DRAFT" | "ARCHIVED";
  tier?: "PUBLIC" | "LOGGED_IN";
  hls?: "READY" | "PROCESSING" | "FAILED" | "MISSING_SOURCE";
  sort?: "created" | "published" | "title" | "views";
  page?: number;
};

const SORT_FIELD: Record<NonNullable<ContentFilters["sort"]>, string> = { created: "createdAt", published: "publishedAt", title: "title", views: "views" };

export type ContentListResult = { items: AdminVideoDto[]; total: number; page: number; totalPages: number; thumbs: Record<string, ThumbnailState> };

export async function listContent(filters: ContentFilters, ctx: AppContext): Promise<UseCaseResult<ContentListResult, AppError>> {
  const list = await getAdminVideoList(
    {
      query: filters.q?.trim() || undefined,
      status: filters.status,
      tier: filters.tier,
      migrationStatus: filters.hls,
      page: Math.max(1, filters.page ?? 1),
      limit: CONTENT_PAGE_SIZE,
      orderBy: SORT_FIELD[filters.sort ?? "created"],
    },
    ctx,
  );
  if (!list.ok) return fail(list.error as AppError);
  return ok({ ...list.data, thumbs: await thumbnailStates(list.data.items.map((v) => v.id), ctx) });
}

/** The admin DTO carries a derived src, not the stored cover; one small query gives the real state. */
async function thumbnailStates(ids: string[], ctx: AppContext): Promise<Record<string, ThumbnailState>> {
  if (!ids.length) return {};
  const rows = await ctx.prisma.video.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, thumbnailUrl: true, thumbnailPublicUrl: true } });
  return Object.fromEntries(rows.map((r) => [r.id, thumbnailState(r)]));
}

export type ContentDetail = { video: AdminVideoDetailsDto; pipeline: PipelineStateDto | null; thumb: ThumbnailState | null };

export async function getContentDetail(idOrSlug: string, ctx: AppContext): Promise<UseCaseResult<ContentDetail, AppError>> {
  const details = await getAdminVideoDetails({ idOrSlug }, ctx);
  if (!details.ok) return fail(details.error as AppError);
  const [pipeline, thumbs] = await Promise.all([getPipelineState({ videoId: details.data.id }, ctx), thumbnailStates([details.data.id], ctx)]);
  return ok({ video: details.data, pipeline: pipeline.ok ? pipeline.data : null, thumb: thumbs[details.data.id] ?? null });
}

/** Raw storage value of the cover (the admin DTO carries a derived public src), for the panel's own proxy. */
export async function getThumbnailSource(videoId: string, ctx: AppContext): Promise<{ thumbnailUrl: string | null; status: VideoStatus } | null> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.preview", { channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status } });
  if (denied) return null;
  return ctx.prisma.video.findFirst({ where: { id: videoId, creatorId: channel.id }, select: { thumbnailUrl: true, status: true } });
}

/**
 * Deleting a film = delete the rows (cascade) and, IN THE SAME TRANSACTION, record what the film owns in R2 as a
 * durable clean-up job (HLS outputs, originals, the panel's own subtitle files). The job then removes the objects
 * (right away, and by the minute cron if this process dies or R2 refuses) until every removal is confirmed.
 */
export async function deleteVideoWithStorage(videoId: string, ctx: AppContext): Promise<UseCaseResult<AdminVideoDto, AppError>> {
  const denied = await authorize(ctx, "video.delete", { videoId });
  if (denied) return fail(denied);
  const details = await getAdminVideoDetails({ idOrSlug: videoId }, ctx);
  const subtitles = new Set([...(details.ok ? [details.data.subtitleUrlPl, details.data.subtitleUrlEn] : []), ...(await translationSubtitleUrls(videoId, ctx).catch(() => [] as string[]))]);
  const publicKeys: string[] = [];
  const captionKeys: string[] = [];
  for (const value of subtitles) {
    const ref = parseCaptionRef(value);
    if (ref) {
      // The key is built from the row's real id (the argument may be a slug); an id of an unexpected shape just has no manifest entry.
      try {
        captionKeys.push(captionObjectKey(details.ok ? details.data.id : videoId, ref.file));
      } catch {
        /* not one of our ids */
      }
    } else if (R2ThumbnailStorageClient.isPublicServingConfigured()) {
      // Legacy file of the public bucket (before captions became private).
      const key = parsePublicThumbnailUrl(value, process.env);
      if (key && key.includes("/subtitles/")) publicKeys.push(key);
    }
  }
  const result = await deleteAdminVideo(videoId, ctx, { beforeDelete: (tx) => enqueueStorageCleanupInTx(tx, videoId, publicKeys, captionKeys) });
  if (!result.ok) return fail(result.error as AppError);
  kickStorageCleanup();
  return ok(result.data);
}

export type LayoutItem = { id: string; slug: string; title: string; tier: AccessTier; showInSidebar: boolean; isMainFeatured: boolean; sidebarOrder: number; premiereAt: Date | null };

/** Published films in the order the site shows them (sidebar order, then newest). */
export async function getChannelLayout(ctx: AppContext): Promise<LayoutItem[]> {
  const channel = await MainChannelService.getRequired(ctx);
  return ctx.prisma.video.findMany({
    where: { creatorId: channel.id, status: "PUBLISHED" },
    orderBy: [{ showInSidebar: "desc" }, { sidebarOrder: "asc" }, { publishedAt: "desc" }],
    select: { id: true, slug: true, title: true, tier: true, showInSidebar: true, isMainFeatured: true, sidebarOrder: true, premiereAt: true },
  });
}

/**
 * Saves the whole layout from one form: order and visibility of every published film, then the Hero.
 * The Hero goes through updateAdminVideo (Hero rules, the previous Hero cleared); an invalid Hero leaves
 * the new order saved and reports the reason.
 */
export async function saveChannelLayout(
  input: { order: string[]; hidden: string[]; heroId: string | null },
  ctx: AppContext,
): Promise<UseCaseResult<{ saved: number }, AppError>> {
  const current = await getChannelLayout(ctx);
  const known = new Set(current.map((v) => v.id));
  if (input.order.some((id) => !known.has(id)) || new Set(input.order).size !== input.order.length) {
    return fail(new AppError("Lista filmów się zmieniła. Odśwież układ i spróbuj ponownie.", 409, "LAYOUT_STALE"));
  }
  const hidden = new Set(input.hidden);
  const updates = input.order.map((id, index) => ({ id, sidebarOrder: index, showInSidebar: !hidden.has(id) }));
  const saved = await reorderAdminVideos(updates, ctx);
  if (!saved.ok) return fail(saved.error as AppError);
  const currentHero = current.find((v) => v.isMainFeatured)?.id ?? null;
  if (input.heroId && input.heroId !== currentHero) {
    const hero = await updateAdminVideo({ id: input.heroId, isMainFeatured: true }, ctx);
    if (!hero.ok) return fail(hero.error as AppError);
  }
  await recordAuditEventSafe(ctx, { action: "VIDEO_LAYOUT_SAVED", targetType: "Channel", targetId: null, metadata: { count: updates.length, hidden: hidden.size, heroChanged: !!input.heroId && input.heroId !== currentHero } });
  return ok({ saved: updates.length });
}
