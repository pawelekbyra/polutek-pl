import { Video, VideoAsset, Prisma, AccessTier, VideoStatus, VideoCommentsMode } from "@prisma/client";
import { accessTierWhere, parseVideoAccessTier } from "@/lib/access-tier";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoNotFoundError, VideoNotOnMainChannelError, VideoInvalidHeroError, VideoInvalidSidebarError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";
import { withPrimaryAsset } from "../domain/video-asset-selection";
import { pickFundraisingUpdate, type FundraisingGoalFields } from "../domain/fundraising";
import { publiclyVisibleChannelWhere } from "@/lib/modules/channel";
import { isDerivedThumbnailUrl } from "@/lib/modules/media"; // derived thumbnail srcs are never stored
import type { ChapterInput } from "@/lib/video-chapters";

type VideoWithAssetsAndOriginal = Video & {
  assets: VideoAsset[];
  activePlaybackRoute?: { asset?: VideoAsset | null } | null;
  originals?: unknown[];
  original?: unknown;
};

const ACTIVE_PLAYBACK_ROUTE_INCLUDE = { activePlaybackRoute: { include: { asset: true } } } as const;

export interface CreateVideoInput {
  title: string;
  slug: string;
  thumbnailUrl?: string | null;
  tier: AccessTier;
  status?: VideoStatus;
  description?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  duration?: string | null;
  subtitleUrlPl?: string | null;
  subtitleUrlEn?: string | null;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sidebarOrder?: number;
  publishAfterAssetReady?: boolean;
  publishAfterAssetReadyRequestedAt?: Date | null;
  publishAfterAssetReadyCompletedAt?: Date | null;
  publishAfterAssetReadyError?: string | null;
  /** Scheduled premiere (CLAUDE.md "Premieres"); null = publish now / no premiere. */
  premiereAt?: Date | null;
  /** Creator metadata (lib/video-metadata.ts); validated by the use cases, the repository only stores. */
  tags?: string[];
  category?: string | null;
  commentsMode?: VideoCommentsMode;
  /** Validated by resolveVideoMetadata; null clears. Written on update only (a new video has no length yet). */
  chapters?: ChapterInput[] | null;
  /** Creator's 18+ declaration (signed-in viewers only). */
  isAdult?: boolean;
  /**
   * Only with `publishAfterAssetReady`: what the video becomes when processing finishes (default PUBLISHED).
   * Stored in `Video.publishAfterAssetReadyVisibility` in the same INSERT as the flag.
   */
  readyVisibility?: "PUBLISHED" | "UNLISTED";
}

export interface AdminUpdateVideoInput extends Partial<CreateVideoInput>, FundraisingGoalFields {
  /** Set by updateAdminVideo only (cancelling an upcoming premiere publishes now). */
  publishedAt?: Date | null;
  status?: VideoStatus;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sidebarOrder?: number;
  subtitleUrlPl?: string | null;
  subtitleUrlEn?: string | null;
}

export interface UpdateVideoInput extends AdminUpdateVideoInput {
  id: string;
}

export interface VideoFilterOptions {
  query?: string;
  status?: string;
  tier?: string;
  isMainFeatured?: string;
  showInSidebar?: string;
  migrationStatus?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
}

export class VideoRepository {
  constructor(private db: ReadDb) {}

  async findById(id: string): Promise<Video | null> {
    return await this.db.video.findUnique({
        where: { id },
        include: { _count: { select: { comments: true } } }
    });
  }

  async findByIdWithAsset(id: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    const video = await this.db.video.findUnique({
        where: { id },
        include: { assets: true, ...ACTIVE_PLAYBACK_ROUTE_INCLUDE }
    });
    return withPrimaryAsset(video as (Video & { assets: VideoAsset[] }) | null);
  }

  async findByIdWithAssets(id: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    return await this.findByIdWithAsset(id);
  }

  async findByIdForMainChannel(id: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    const video = await this.db.video.findFirst({
        where: { id, creatorId: mainChannelId },
        include: {
            _count: { select: { comments: true } },
            assets: true,
            originals: { orderBy: { version: "desc" }, take: 1 },
            ...ACTIVE_PLAYBACK_ROUTE_INCLUDE,
        }
    });
    const videoWithOriginal: VideoWithAssetsAndOriginal | null = video ? {
        ...video,
        original: video.originals?.[0] ?? null,
    } : null;
    return withPrimaryAsset(videoWithOriginal);
  }

  async findByIdForMainChannelWithAssets(id: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    return await this.findByIdForMainChannel(id, mainChannelId);
  }

  async findBySlugForMainChannel(slug: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    const video = await this.db.video.findFirst({
        where: { slug, creatorId: mainChannelId },
        include: {
            _count: { select: { comments: true } },
            assets: true,
            originals: { orderBy: { version: "desc" }, take: 1 },
            ...ACTIVE_PLAYBACK_ROUTE_INCLUDE,
        }
    });
    const videoWithOriginal: VideoWithAssetsAndOriginal | null = video ? {
        ...video,
        original: video.originals?.[0] ?? null,
    } : null;
    return withPrimaryAsset(videoWithOriginal);
  }

  async findBySlugForMainChannelWithAssets(slug: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    return await this.findBySlugForMainChannel(slug, mainChannelId);
  }

  async findAdminByIdOrSlugForMainChannel(idOrSlug: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    const { isUuid } = await import("@/lib/utils/uuid");
    if (isUuid(idOrSlug)) {
        return await this.findByIdForMainChannel(idOrSlug, mainChannelId);
    }
    return await this.findBySlugForMainChannel(idOrSlug, mainChannelId);
  }

  async findBySlug(slug: string): Promise<Video | null> {
    return await this.db.video.findUnique({
        where: { slug },
        include: { _count: { select: { comments: true } } }
    });
  }

  async existsBySlugExcludingId(slug: string, excludedId: string): Promise<boolean> {
    const existing = await this.db.video.findFirst({
      where: {
        slug,
        id: { not: excludedId },
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async findPublicList(mainChannelId: string, now: Date): Promise<Video[]> {
    return await this.db.video.findMany({
      where: {
        creatorId: mainChannelId,
        status: 'PUBLISHED',
        OR: [
            { publishedAt: null },
            { publishedAt: { lte: now } }
        ],
        showInSidebar: true,
        creator: publiclyVisibleChannelWhere()
      },
      orderBy: [
        { sidebarOrder: 'asc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async findAdminList(mainChannelId: string, filters: VideoFilterOptions): Promise<{ items: Video[]; total: number }> {
    const where: Prisma.VideoWhereInput = { creatorId: mainChannelId };

    if (filters.status && filters.status !== 'ALL' && isVideoStatus(filters.status)) where.status = filters.status;
    const tierWhere = accessTierWhere(filters.tier);
    if (tierWhere) where.tier = tierWhere;
    if (filters.isMainFeatured === 'true') where.isMainFeatured = true;
    if (filters.isMainFeatured === 'false') where.isMainFeatured = false;
    if (filters.showInSidebar === 'true') where.showInSidebar = true;
    if (filters.showInSidebar === 'false') where.showInSidebar = false;

    // migrationStatus is the state of the own-HLS source: READY / PROCESSING / FAILED, no source at all,
    // or "needs re-upload" (a leftover asset of a provider we no longer support).
    if (filters.migrationStatus && filters.migrationStatus !== 'ALL') {
      if (filters.migrationStatus === 'READY') {
        where.assets = { some: { isPrimary: true, provider: VIDEO_PROVIDER.SELF_HLS, processingState: VIDEO_ASSET_PROCESSING_STATE.READY } };
      } else if (filters.migrationStatus === 'PROCESSING') {
        where.assets = { some: { isPrimary: true, provider: VIDEO_PROVIDER.SELF_HLS, processingState: { in: [VIDEO_ASSET_PROCESSING_STATE.PENDING, VIDEO_ASSET_PROCESSING_STATE.UPLOADING, VIDEO_ASSET_PROCESSING_STATE.PROCESSING] } } };
      } else if (filters.migrationStatus === 'FAILED') {
        where.assets = { some: { isPrimary: true, provider: VIDEO_PROVIDER.SELF_HLS, processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED } };
      } else if (filters.migrationStatus === 'MISSING_SOURCE') {
        where.assets = { none: {} };
      } else if (filters.migrationStatus === 'MIGRATION_REQUIRED') {
        where.assets = { some: { isPrimary: true, provider: { not: VIDEO_PROVIDER.SELF_HLS } } };
      }
    }

    if (filters.query) {
      const queryOr: Prisma.VideoWhereInput[] = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { slug: { contains: filters.query, mode: 'insensitive' } }
      ];
      where.OR = queryOr;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.video.findMany({
        where,
        orderBy: { [filters.orderBy || 'createdAt']: 'desc' },
        skip,
        take: limit,
        include: {
            _count: { select: { comments: true } },
            assets: true
        }
      }),
      this.db.video.count({ where })
    ]);

    return { items, total };
  }

  async findHero(mainChannelId: string, now: Date): Promise<Video | null> {
    return await this.db.video.findFirst({
      where: {
        creatorId: mainChannelId,
        isMainFeatured: true,
        status: 'PUBLISHED',
        tier: 'PUBLIC',
        OR: [
            { publishedAt: null },
            { publishedAt: { lte: now } }
        ],
        creator: publiclyVisibleChannelWhere()
      }
    });
  }

  async createForMainChannel(input: CreateVideoInput, mainChannelId: string, tx: WriteTx): Promise<Video> {
    if (!mainChannelId) throw new AppError("Main channel ID is required to create a video.", 400, "VIDEO_MISSING_CHANNEL");

    const data: Prisma.VideoCreateInput = {
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      titleEn: input.titleEn ?? null,
      descriptionEn: input.descriptionEn ?? null,
      thumbnailUrl: input.thumbnailUrl ?? '',
      duration: input.duration ?? null,
      tier: parseVideoAccessTier(input.tier) ?? 'PUBLIC',
      creator: { connect: { id: mainChannelId } },
      status: 'DRAFT',
      showInSidebar: false,
      isMainFeatured: false,
      sidebarOrder: 0,
      views: 0,
      likesCount: 0,
      dislikesCount: 0,
      publishedAt: null,
      premiereAt: input.premiereAt ?? null,
      publishAfterAssetReady: Boolean(input.publishAfterAssetReady),
      publishAfterAssetReadyRequestedAt: input.publishAfterAssetReady ? (input.publishAfterAssetReadyRequestedAt || new Date()) : null,
      publishAfterAssetReadyCompletedAt: null,
      publishAfterAssetReadyError: null,
      // Same INSERT as the flag: the target visibility can never be missing for a pending auto-publication.
      publishAfterAssetReadyVisibility: input.publishAfterAssetReady ? (input.readyVisibility === "UNLISTED" ? "UNLISTED" : "PUBLISHED") : null,
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.commentsMode !== undefined ? { commentsMode: input.commentsMode } : {}),
      ...(input.isAdult !== undefined ? { isAdult: input.isAdult === true } : {}),
    };

    return await tx.video.create({ data });
  }

  async updateForMainChannel(input: UpdateVideoInput, mainChannelId: string, tx: WriteTx): Promise<Video> {
    const { id, status, ...data } = input;
    const updateData: Prisma.VideoUpdateManyMutationInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.thumbnailUrl !== undefined && !isDerivedThumbnailUrl(data.thumbnailUrl, process.env)) updateData.thumbnailUrl = data.thumbnailUrl ?? '';
    if (data.tier !== undefined) updateData.tier = parseVideoAccessTier(data.tier) ?? 'LOGGED_IN';
    if (data.description !== undefined) updateData.description = data.description;
    if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
    if (data.descriptionEn !== undefined) updateData.descriptionEn = data.descriptionEn;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.isMainFeatured !== undefined) updateData.isMainFeatured = data.isMainFeatured;
    if (data.showInSidebar !== undefined) updateData.showInSidebar = data.showInSidebar;
    if (data.sidebarOrder !== undefined) updateData.sidebarOrder = data.sidebarOrder;
    if (data.publishAfterAssetReady !== undefined) updateData.publishAfterAssetReady = data.publishAfterAssetReady;
    if (data.publishAfterAssetReadyRequestedAt !== undefined) updateData.publishAfterAssetReadyRequestedAt = data.publishAfterAssetReadyRequestedAt;
    if (data.publishAfterAssetReadyCompletedAt !== undefined) updateData.publishAfterAssetReadyCompletedAt = data.publishAfterAssetReadyCompletedAt;
    if (data.publishAfterAssetReadyError !== undefined) updateData.publishAfterAssetReadyError = data.publishAfterAssetReadyError;
    if (data.subtitleUrlPl !== undefined) updateData.subtitleUrlPl = data.subtitleUrlPl;
    if (data.subtitleUrlEn !== undefined) updateData.subtitleUrlEn = data.subtitleUrlEn;
    if (data.premiereAt !== undefined) updateData.premiereAt = data.premiereAt;
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt;
    if (data.tags !== undefined) updateData.tags = data.tags;
    // A JSON null would be stored as the JSON value null; clearing must write SQL NULL.
    if (data.chapters !== undefined) updateData.chapters = data.chapters === null ? Prisma.DbNull : (data.chapters as unknown as Prisma.InputJsonValue);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.commentsMode !== undefined) updateData.commentsMode = data.commentsMode;
    if (data.isAdult !== undefined) updateData.isAdult = data.isAdult === true;
    Object.assign(updateData, pickFundraisingUpdate(data));

    if (status && status !== VideoStatus.PUBLISHED) {
      updateData.status = status;
      updateData.isMainFeatured = false;
      updateData.showInSidebar = false;
    }

    const result = await tx.video.updateMany({
        where: { id, creatorId: mainChannelId },
        data: updateData
    });

    if (result.count !== 1) {
        throw new VideoNotOnMainChannelError(id);
    }

    const updated = await tx.video.findFirst({
        where: { id, creatorId: mainChannelId },
        include: { _count: { select: { comments: true } } }
    });

    if (!updated) throw new VideoNotFoundError(id);
    return updated;
  }

  async archiveVideo(id: string, mainChannelId: string, tx: WriteTx): Promise<Video> {
    const result = await tx.video.updateMany({
      where: { id, creatorId: mainChannelId },
      data: { status: 'ARCHIVED', isMainFeatured: false, showInSidebar: false }
    });

    if (result.count !== 1) {
      throw new VideoNotOnMainChannelError(id);
    }

    const updated = await tx.video.findFirst({
      where: { id, creatorId: mainChannelId },
      include: { _count: { select: { comments: true } } }
    });
    if (!updated) throw new VideoNotFoundError(id);
    return updated;
  }

  async clearHero(mainChannelId: string, exceptVideoId: string, tx: WriteTx): Promise<void> {
    await tx.video.updateMany({
      where: {
        creatorId: mainChannelId,
        isMainFeatured: true,
        id: { not: exceptVideoId },
      },
      data: { isMainFeatured: false },
    });
  }

  async setHero(id: string, mainChannelId: string, tx: WriteTx): Promise<void> {
    const loaded = await tx.video.findFirst({ where: { id, creatorId: mainChannelId }, include: { assets: true, ...ACTIVE_PLAYBACK_ROUTE_INCLUDE } });
    const video = withPrimaryAsset(loaded as (Video & { assets: VideoAsset[] }) | null);
    if (!video) throw new VideoNotOnMainChannelError(id);

    const blockers = VideoPolicy.getHeroBlockers(video);
    if (blockers.length > 0) throw new VideoInvalidHeroError(`${blockers[0].code}: ${blockers[0].message}`);

    await tx.video.updateMany({
      where: { creatorId: mainChannelId, isMainFeatured: true },
      data: { isMainFeatured: false },
    });

    const result = await tx.video.updateMany({
      where: { id, creatorId: mainChannelId },
      data: { isMainFeatured: true },
    });

    if (result.count !== 1) throw new VideoNotOnMainChannelError(id);
  }

  async reorder(
    updates: Array<{ id: string; sidebarOrder: number; showInSidebar: boolean }>,
    mainChannelId: string,
    tx: WriteTx
  ): Promise<void> {
    for (const update of updates) {
      const video = await tx.video.findUnique({
        where: { id: update.id },
        select: { creatorId: true, status: true },
      });

      if (!video || video.creatorId !== mainChannelId) {
        throw new VideoNotOnMainChannelError(update.id);
      }
      if (update.showInSidebar) {
        const blockers = VideoPolicy.getSidebarBlockers(video);
        if (blockers.length > 0) throw new VideoInvalidSidebarError(`${blockers[0].code}: ${blockers[0].message}`);
      }
    }

    for (const update of updates) {
      await tx.video.updateMany({
        where: { id: update.id, creatorId: mainChannelId },
        data: {
          sidebarOrder: update.sidebarOrder,
          showInSidebar: update.showInSidebar,
        },
      });
    }
  }
}

function isVideoStatus(value: string): value is VideoStatus {
  return Object.values(VideoStatus).includes(value as VideoStatus);
}

