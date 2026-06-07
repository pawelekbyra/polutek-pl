import { prisma } from '@/lib/prisma';
import { VideoStatus, AccessTier, Prisma } from '@prisma/client';
import { VideosDiagnosticsService } from './videos-diagnostics.service';
import { AdminVideoListItem, AdminVideosListResponse, VideoSortField, VIDEO_SORT_FIELDS } from './videos-admin.dto';

export interface VideoFilterOptions {
  query?: string;
  status?: VideoStatus;
  tier?: AccessTier;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  sourceKind?: string;
  needsAttention?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class VideosAdminService {
  static async getVideos(options: VideoFilterOptions, creatorId?: string): Promise<AdminVideosListResponse> {
    const {
      query,
      status,
      tier,
      isMainFeatured,
      showInSidebar,
      sourceKind,
      needsAttention,
      page = 1,
      pageSize = 20,
      orderBy = 'createdAt',
      orderDir = 'desc'
    } = options;

    const skip = (page - 1) * pageSize;

    const where: Prisma.VideoWhereInput = {
      creatorId,
      AND: [
        query ? {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { titleEn: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { descriptionEn: { contains: query, mode: 'insensitive' } },
            { videoUrl: { contains: query, mode: 'insensitive' } },
          ]
        } : {},
        status ? { status } : {},
        tier ? { tier } : {},
        isMainFeatured !== undefined ? { isMainFeatured } : {},
        showInSidebar !== undefined ? { showInSidebar } : {},
        sourceKind ? (
            sourceKind === 'YOUTUBE' ? { videoUrl: { contains: 'youtube' } } :
            sourceKind === 'VIMEO' ? { videoUrl: { contains: 'vimeo' } } :
            ['HLS', 'DASH', 'MP4'].includes(sourceKind) ? { videoUrl: { contains: sourceKind.toLowerCase() } } :
            { asset: { provider: sourceKind as any } }
        ) : {},
      ]
    };

    // Optimization: if we only need a few videos, we can afford diagnostics N+1 or batch.
    // For large lists, we should ideally cache diagnostics or count them differently.
    const [total, items, stats] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.findMany({
        where,
        include: {
          _count: {
            select: {
              comments: true,
              videoLikes: true,
              videoDislikes: true,
              playbackSessions: true
            }
          },
          asset: true
        },
        orderBy: this.getOrderBy(orderBy, orderDir),
        skip,
        take: pageSize,
      }),
      this.getStats()
    ]);

    let itemsWithDiagnostics: AdminVideoListItem[] = await Promise.all(items.map(async (item) => {
        const diagnostics = await VideosDiagnosticsService.diagnoseVideo(item.id);
        return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            titleEn: item.titleEn,
            description: item.description,
            descriptionEn: item.descriptionEn,
            status: item.status,
            tier: item.tier,
            videoUrl: item.videoUrl,
            thumbnailUrl: item.thumbnailUrl,
            isMainFeatured: item.isMainFeatured,
            showInSidebar: item.showInSidebar,
            sidebarOrder: item.sidebarOrder,
            sourceKind: item.asset?.provider || 'UNKNOWN',
            provider: item.asset?.provider || 'UNKNOWN',
            views: item.views,
            likesCount: item.likesCount,
            dislikesCount: item.dislikesCount,
            commentsCount: item._count.comments,
            diagnosticsIssuesCount: diagnostics.length,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            publishedAt: item.publishedAt?.toISOString() || null,
        };
    }));

    if (needsAttention) {
        itemsWithDiagnostics = itemsWithDiagnostics.filter(i => i.diagnosticsIssuesCount > 0);
    }

    return {
      items: itemsWithDiagnostics,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats
    };
  }

  static async getStats() {
    const [total, published, drafts, archived, publicT, loggedIn, patron] = await Promise.all([
        prisma.video.count(),
        prisma.video.count({ where: { status: 'PUBLISHED' } }),
        prisma.video.count({ where: { status: 'DRAFT' } }),
        prisma.video.count({ where: { status: 'ARCHIVED' } }),
        prisma.video.count({ where: { tier: 'PUBLIC' } }),
        prisma.video.count({ where: { tier: 'LOGGED_IN' } }),
        prisma.video.count({ where: { tier: 'PATRON' } }),
    ]);

    return {
        total,
        published,
        drafts,
        archived,
        public: publicT,
        loggedIn,
        patron
    };
  }

  private static getOrderBy(field: string, dir: 'asc' | 'desc'): Prisma.VideoOrderByWithRelationInput {
    if (!VIDEO_SORT_FIELDS.includes(field as VideoSortField)) {
      return { createdAt: 'desc' };
    }

    return { [field]: dir };
  }
}
