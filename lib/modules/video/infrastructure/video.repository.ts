import { Video, Prisma, AccessTier, VideoStatus } from "@prisma/client";
import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoNotFoundError } from "../domain/video.errors";

export interface CreateVideoInput {
  title: string;
  slug: string;
  videoUrl: string;
  thumbnailUrl: string;
  tier: AccessTier;
  status: VideoStatus;
  description?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sidebarOrder?: number;
}

export interface UpdateVideoInput extends Partial<CreateVideoInput> {
  id: string;
}

export interface VideoFilterOptions {
  query?: string;
  status?: string;
  tier?: string;
  isMainFeatured?: string;
  showInSidebar?: string;
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
        include: { _count: { select: { comments: true } } }
      }),
      this.db.video.count({ where })
    ]);

    return { items, total };
  }

  async findHero(mainChannelId: string): Promise<Video | null> {
    return await this.db.video.findFirst({
      where: { creatorId: mainChannelId, isMainFeatured: true, status: 'PUBLISHED' }
    });
  }

  async createForMainChannel(input: CreateVideoInput, mainChannelId: string, tx: WriteTx): Promise<Video> {
    if (!mainChannelId) throw new AppError("Main channel ID is required to create a video.", 400, "VIDEO_MISSING_CHANNEL");

    return await tx.video.create({
      data: {
        ...input,
        creatorId: mainChannelId,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null
      }
    });
  }

  async updateForMainChannel(input: UpdateVideoInput, mainChannelId: string, tx: WriteTx): Promise<Video> {
    const { id, ...data } = input;

    // We use updateMany + find to enforce creatorId boundary without extra fetch first if possible,
    // but update returns number of records. So we use update with compound where if supported,
    // or just check id existence. Prisma update only takes unique id.
    // So we'll use updateMany then fetch or just a simple update and rely on policy check before.
    // Masterplan says: use updateMany with where {id, creatorId}

    await tx.video.updateMany({
        where: { id, creatorId: mainChannelId },
        data: {
            ...data,
            publishedAt: data.status === 'PUBLISHED' ? new Date() : undefined
        }
    });

    const updated = await tx.video.findUnique({
        where: { id },
        include: { _count: { select: { comments: true } } }
    });
    if (!updated) throw new VideoNotFoundError(id);
    return updated;
  }

  async archiveVideo(id: string, mainChannelId: string, tx: WriteTx): Promise<Video> {
    await tx.video.updateMany({
      where: { id, creatorId: mainChannelId },
      data: { status: 'ARCHIVED' }
    });
    const updated = await tx.video.findUnique({ where: { id } });
    if (!updated) throw new VideoNotFoundError(id);
    return updated;
  }

  async setHero(videoId: string, mainChannelId: string, tx: WriteTx): Promise<void> {
    // Transactional: clear other heroes and set this one
    await tx.video.updateMany({
      where: { creatorId: mainChannelId, isMainFeatured: true },
      data: { isMainFeatured: false }
    });

    await tx.video.update({
      where: { id: videoId },
      data: { isMainFeatured: true }
    });
  }

  async clearHero(mainChannelId: string, except: string, tx: WriteTx): Promise<void> {
    await tx.video.updateMany({
      where: { creatorId: mainChannelId, isMainFeatured: true, id: { not: except } },
      data: { isMainFeatured: false }
    });
  }

  async reorder(updates: Array<{ id: string; sidebarOrder: number; showInSidebar: boolean }>, mainChannelId: string, tx: WriteTx): Promise<void> {
    for (const v of updates) {
        const video = await tx.video.findUnique({ where: { id: v.id }, select: { creatorId: true } });
        if (!video || video.creatorId !== mainChannelId) {
            throw new AppError(`Video ${v.id} does not belong to main channel. Reorder aborted.`, 403, "VIDEO_NOT_ON_MAIN_CHANNEL");
        }

        await tx.video.update({
            where: { id: v.id },
            data: {
                sidebarOrder: v.sidebarOrder,
                showInSidebar: v.showInSidebar
            }
        });
    }
  }
}
