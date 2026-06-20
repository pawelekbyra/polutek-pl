import { Video, VideoAsset, Prisma, AccessTier, VideoStatus, StorageProvider } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoNotFoundError, VideoNotOnMainChannelError, VideoInvalidHeroError } from "../domain/video.errors";

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
  likesCount?: number;
  dislikesCount?: number;
  views?: number;
}

export interface AdminUpdateVideoInput extends Partial<CreateVideoInput> {
  videoUrl?: string | null;
  status?: VideoStatus;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sidebarOrder?: number;
  likesCount?: number;
  dislikesCount?: number;
  views?: number;
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

  async findByIdWithAsset(id: string): Promise<(Video & { asset: VideoAsset | null }) | null> {
    return await this.db.video.findUnique({
        where: { id },
        include: { asset: true }
    }) as (Video & { asset: VideoAsset | null }) | null;
  }

  async findByIdForMainChannel(id: string, mainChannelId: string): Promise<(Video & { asset: VideoAsset | null }) | null> {
    return await this.db.video.findFirst({
        where: { id, creatorId: mainChannelId },
        include: {
            _count: { select: { comments: true } },
            asset: true
        }
    }) as (Video & { asset: VideoAsset | null }) | null;
  }

  async findBySlugForMainChannel(slug: string, mainChannelId: string): Promise<(Video & { asset: VideoAsset | null }) | null> {
    return await this.db.video.findFirst({
        where: { slug, creatorId: mainChannelId },
        include: {
            _count: { select: { comments: true } },
            asset: true
        }
    }) as (Video & { asset: VideoAsset | null }) | null;
  }

  async findAdminByIdOrSlugForMainChannel(idOrSlug: string, mainChannelId: string): Promise<(Video & { asset: VideoAsset | null }) | null> {
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

    if (filters.status && filters.status !== 'ALL') where.status = filters.status as any;
    if (filters.tier && filters.tier !== 'ALL') where.tier = filters.tier as any;
    if (filters.isMainFeatured === 'true') where.isMainFeatured = true;
    if (filters.isMainFeatured === 'false') where.isMainFeatured = false;
    if (filters.showInSidebar === 'true') where.showInSidebar = true;
    if (filters.showInSidebar === 'false') where.showInSidebar = false;

    if (filters.migrationStatus && filters.migrationStatus !== 'ALL') {
      if (filters.migrationStatus === 'READY') {
        where.asset = { is: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.READY } };
      } else if (filters.migrationStatus === 'PROCESSING') {
        where.asset = { is: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: { in: [VIDEO_ASSET_PROCESSING_STATE.PENDING, VIDEO_ASSET_PROCESSING_STATE.UPLOADING, VIDEO_ASSET_PROCESSING_STATE.PROCESSING] } } };
      } else if (filters.migrationStatus === 'FAILED') {
        where.asset = { is: { provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM, processingState: VIDEO_ASSET_PROCESSING_STATE.FAILED } };
      } else if (filters.migrationStatus === 'MISSING_SOURCE') {
        where.asset = null;
        where.videoUrl = '';
      } else if (filters.migrationStatus === 'MIGRATION_REQUIRED') {
        where.OR = [
          { asset: { is: { provider: { in: [VIDEO_PROVIDER.R2, VIDEO_PROVIDER.S3, VIDEO_PROVIDER.VERCEL_BLOB] } } } },
          { AND: [ { asset: null }, { videoUrl: { not: '' } } ] }
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
            asset: true
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
      thumbnailUrl: input.thumbnailUrl || "/logo.png",
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
    };

    return await tx.video.create({ data });
  }

  async updateForMainChannel(input: UpdateVideoInput, mainChannelId: string, tx: WriteTx): Promise<Video> {
    const { id, ...data } = input;

    // Generic update cannot set status to PUBLISHED
    if ((data as any).status === 'PUBLISHED') {
      delete (data as any).status;
    }

    const result = await tx.video.updateMany({
        where: { id, creatorId: mainChannelId },
        data: {
            ...(data as Prisma.VideoUpdateManyMutationInput),
            publishedAt: data.status === 'PUBLISHED' ? new Date() : undefined
        }
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
      data: { status: 'ARCHIVED' }
    });

    if (result.count !== 1) {
      throw new VideoNotFoundError(id);
    }

    const updated = await tx.video.findUnique({ where: { id } });
    if (!updated) throw new VideoNotFoundError(id);
    return updated;
  }

  async updateVideoAsset(videoId: string, input: {
    provider?: StorageProvider;
    objectKey?: string;
    bucket?: string | null;
    providerAssetId?: string | null;
    providerPlaybackId?: string | null;
    processingState?: string;
    isPrimary?: boolean;
    failureReason?: string | null;
    providerSyncedAt?: Date | null;
    processingStartedAt?: Date | null;
    processingEndedAt?: Date | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  }, tx: WriteTx): Promise<VideoAsset> {
    return await (tx as any).videoAsset.upsert({
      where: { videoId },
      update: {
        provider: input.provider,
        objectKey: input.objectKey,
        bucket: input.bucket,
        providerAssetId: input.providerAssetId,
        providerPlaybackId: input.providerPlaybackId,
        processingState: input.processingState as any,
        isPrimary: input.isPrimary,
        failureReason: input.failureReason,
        providerSyncedAt: input.providerSyncedAt,
        processingStartedAt: input.processingStartedAt,
        processingEndedAt: input.processingEndedAt,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
      create: {
        videoId,
        provider: input.provider || VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        objectKey: input.objectKey || input.providerAssetId || videoId,
        bucket: input.bucket,
        providerAssetId: input.providerAssetId,
        providerPlaybackId: input.providerPlaybackId,
        processingState: input.processingState as any || VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: input.isPrimary ?? true,
        failureReason: input.failureReason,
        providerSyncedAt: input.providerSyncedAt,
        processingStartedAt: input.processingStartedAt,
        processingEndedAt: input.processingEndedAt,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
  }
}
