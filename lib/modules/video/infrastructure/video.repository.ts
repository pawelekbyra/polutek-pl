import { Video, VideoAsset, Prisma, AccessTier, VideoStatus, StorageProvider, VideoAssetProcessingState } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoNotFoundError, VideoNotOnMainChannelError, VideoInvalidHeroError, VideoInvalidSidebarError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";
import { selectPrimaryVideoAsset, withPrimaryAsset } from "../domain/video-asset-selection";

export interface CreateVideoInput {
  title: string;
  slug: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  tier: AccessTier;
  status?: VideoStatus;
  description?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  duration?: string | null;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sidebarOrder?: number;
  publishAfterAssetReady?: boolean;
  publishAfterAssetReadyRequestedAt?: Date | null;
  publishAfterAssetReadyCompletedAt?: Date | null;
  publishAfterAssetReadyError?: string | null;
}

export interface AdminUpdateVideoInput extends Partial<CreateVideoInput> {
  videoUrl?: string | null;
  status?: VideoStatus;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sidebarOrder?: number;
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
        include: { assets: true }
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
            assets: true
        }
    });
    return withPrimaryAsset(video as (Video & { assets: VideoAsset[] }) | null);
  }

  async findByIdForMainChannelWithAssets(id: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    return await this.findByIdForMainChannel(id, mainChannelId);
  }

  async findBySlugForMainChannel(slug: string, mainChannelId: string): Promise<(Video & { assets: VideoAsset[]; asset: VideoAsset | null }) | null> {
    const video = await this.db.video.findFirst({
        where: { slug, creatorId: mainChannelId },
        include: {
            _count: { select: { comments: true } },
            assets: true
        }
    });
    return withPrimaryAsset(video as (Video & { assets: VideoAsset[] }) | null);
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
        tier: { in: ['PUBLIC', 'LOGGED_IN', 'PATRON'] },
        creator: {
            isApproved: true,
            isPrimary: true
        }
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
    if (filters.tier && filters.tier !== 'ALL' && isAccessTier(filters.tier)) where.tier = filters.tier;
    if (filters.isMainFeatured === 'true') where.isMainFeatured = true;
    if (filters.isMainFeatured === 'false') where.isMainFeatured = false;
    if (filters.showInSidebar === 'true') where.showInSidebar = true;
    if (filters.showInSidebar === 'false') where.showInSidebar = false;

    if (filters.migrationStatus && filters.migrationStatus !== 'ALL') {
      if (filters.migrationStatus === 'READY') {
        where.assets = { some: { isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.READY } };
      } else if (filters.migrationStatus === 'PROCESSING') {
        where.assets = { some: { isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: { in: [VIDEO_ASSET_PROCESSING_STATE.PENDING, VIDEO_ASSET_PROCESSING_STATE.UPLOADING, VIDEO_ASSET_PROCESSING_STATE.PROCESSING] } } };
      } else if (filters.migrationStatus === 'FAILED') {
        where.assets = { some: { isPrimary: true, provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED } };
      } else if (filters.migrationStatus === 'MISSING_SOURCE') {
        where.assets = { none: {} };
        where.videoUrl = '';
      } else if (filters.migrationStatus === 'MIGRATION_REQUIRED') {
        where.OR = [
          { assets: { some: { isPrimary: true, provider: { in: [VIDEO_PROVIDER.R2, VIDEO_PROVIDER.S3, VIDEO_PROVIDER.VERCEL_BLOB] } } } },
          { AND: [ { assets: { none: {} } }, { videoUrl: { not: '' } } ] }
        ];
      }
    }

    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { slug: { contains: filters.query, mode: 'insensitive' } }
      ];
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
        creator: {
            isApproved: true,
            isPrimary: true
        }
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
      tier: input.tier || 'PUBLIC',
      videoUrl: input.videoUrl?.trim() || '',
      creator: { connect: { id: mainChannelId } },
      status: 'DRAFT',
      showInSidebar: false,
      isMainFeatured: false,
      sidebarOrder: 0,
      views: 0,
      likesCount: 0,
      dislikesCount: 0,
      publishedAt: null,
      publishAfterAssetReady: Boolean(input.publishAfterAssetReady),
      publishAfterAssetReadyRequestedAt: input.publishAfterAssetReady ? (input.publishAfterAssetReadyRequestedAt || new Date()) : null,
      publishAfterAssetReadyCompletedAt: null,
      publishAfterAssetReadyError: null,
    };

    return await tx.video.create({ data });
  }

  async updateForMainChannel(input: UpdateVideoInput, mainChannelId: string, tx: WriteTx): Promise<Video> {
    const { id, status, ...data } = input;
    const updateData: Prisma.VideoUpdateManyMutationInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl ?? '';
    if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl ?? '';
    if (data.tier !== undefined) updateData.tier = data.tier;
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
    const loaded = await tx.video.findFirst({ where: { id, creatorId: mainChannelId }, include: { assets: true } });
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

  async findAssetByProviderId(provider: StorageProvider, providerAssetId: string): Promise<VideoAsset | null> {
    return await this.db.videoAsset.findFirst({
      where: { provider, providerAssetId },
    });
  }

  async listAssetsForVideo(videoId: string): Promise<VideoAsset[]> {
    return await this.db.videoAsset.findMany({
      where: { videoId },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async findPrimaryAssetForVideo(videoId: string): Promise<VideoAsset | null> {
    return selectPrimaryVideoAsset(await this.listAssetsForVideo(videoId));
  }

  async updateAsset(assetId: string, input: VideoAssetUpsertInput, tx: WriteTx): Promise<VideoAsset> {
    return await tx.videoAsset.update({
      where: { id: assetId },
      data: buildVideoAssetUpdateData(input),
    });
  }

  async updateVideoAsset(videoId: string, input: VideoAssetUpsertInput, tx: WriteTx): Promise<VideoAsset> {
    return await this.upsertPrimaryAsset(videoId, input, tx);
  }

  async upsertPrimaryAsset(videoId: string, input: VideoAssetUpsertInput, tx: WriteTx): Promise<VideoAsset> {
    const assets = await tx.videoAsset.findMany({
      where: { videoId },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
    const existing = selectPrimaryVideoAsset(assets);

    if (existing) {
      return await tx.videoAsset.update({
        where: { id: existing.id },
        data: { ...buildVideoAssetUpdateData(input), isPrimary: true },
      });
    }

    return await tx.videoAsset.create({
      data: {
        videoId,
        provider: input.provider || VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        objectKey: input.objectKey || input.providerAssetId || videoId,
        bucket: input.bucket,
        providerAssetId: input.providerAssetId,
        providerPlaybackId: input.providerPlaybackId,
        processingState: input.processingState || VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: true,
        failureReason: input.failureReason,
        providerSyncedAt: input.providerSyncedAt,
        processingStartedAt: input.processingStartedAt,
        processingEndedAt: input.processingEndedAt,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
  }

  async upsertAsset(videoId: string, input: VideoAssetUpsertInput, tx: WriteTx): Promise<VideoAsset> {
    if (input.isPrimary === false) {
      return await tx.videoAsset.create({
        data: {
          videoId,
          provider: input.provider || VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          objectKey: input.objectKey || input.providerAssetId || videoId,
          bucket: input.bucket,
          providerAssetId: input.providerAssetId,
          providerPlaybackId: input.providerPlaybackId,
          processingState: input.processingState || VIDEO_ASSET_PROCESSING_STATE.PENDING,
          isPrimary: false,
          failureReason: input.failureReason,
          providerSyncedAt: input.providerSyncedAt,
          processingStartedAt: input.processingStartedAt,
          processingEndedAt: input.processingEndedAt,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      });
    }

    return await this.updateVideoAsset(videoId, input, tx);
  }

  async ensureSinglePrimaryAsset(videoId: string, tx: WriteTx): Promise<VideoAsset | null> {
    const assets = await tx.videoAsset.findMany({
      where: { videoId },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
    if (assets.length === 0) return null;

    const selected = selectPrimaryVideoAsset(assets);
    if (!selected) return null;

    await tx.videoAsset.updateMany({
      where: { videoId, id: { not: selected.id }, isPrimary: true },
      data: { isPrimary: false },
    });

    if (!selected.isPrimary) {
      return await tx.videoAsset.update({
        where: { id: selected.id },
        data: { isPrimary: true },
      });
    }

    return selected;
  }
}

export type VideoAssetUpsertInput = {
  provider?: StorageProvider;
  objectKey?: string;
  bucket?: string | null;
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
  processingState?: VideoAssetProcessingState;
  isPrimary?: boolean;
  failureReason?: string | null;
  providerSyncedAt?: Date | null;
  processingStartedAt?: Date | null;
  processingEndedAt?: Date | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

function buildVideoAssetUpdateData(input: VideoAssetUpsertInput): Prisma.VideoAssetUpdateInput {
  return {
    provider: input.provider,
    objectKey: input.objectKey,
    bucket: input.bucket,
    providerAssetId: input.providerAssetId,
    providerPlaybackId: input.providerPlaybackId,
    processingState: input.processingState,
    isPrimary: input.isPrimary,
    failureReason: input.failureReason,
    providerSyncedAt: input.providerSyncedAt,
    processingStartedAt: input.processingStartedAt,
    processingEndedAt: input.processingEndedAt,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  };
}

function isVideoStatus(value: string): value is VideoStatus {
  return Object.values(VideoStatus).includes(value as VideoStatus);
}

function isAccessTier(value: string): value is AccessTier {
  return Object.values(AccessTier).includes(value as AccessTier);
}
