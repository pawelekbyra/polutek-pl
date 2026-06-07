import { prisma } from '@/lib/prisma';
import { VideoStatus, AccessTier, Prisma } from '@prisma/client';
import { VideosDiagnosticsService } from './videos-diagnostics.service';

export interface VideoFilterOptions {
  query?: string;
  status?: VideoStatus;
  tier?: AccessTier;
  isMainFeatured?: boolean;
  showInSidebar?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class VideosAdminService {
  static async getVideos(options: VideoFilterOptions, creatorId?: string) {
    const {
      query,
      status,
      tier,
      isMainFeatured,
      showInSidebar,
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
      ]
    };

    const [total, items] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.findMany({
        where,
        include: {
          _count: {
            select: {
              comments: true,
              videoLikes: true,
              videoDislikes: true
            }
          },
          asset: true
        },
        orderBy: this.getOrderBy(orderBy, orderDir),
        skip,
        take: pageSize,
      })
    ]);

    const itemsWithDiagnostics = await Promise.all(items.map(async (item) => {
        const diagnostics = await VideosDiagnosticsService.diagnoseVideo(item.id);
        return {
            ...item,
            diagnostics
        };
    }));

    return {
      items: itemsWithDiagnostics,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  private static getOrderBy(field: string, dir: 'asc' | 'desc'): Prisma.VideoOrderByWithRelationInput {
    const whitelist = [
      'createdAt',
      'updatedAt',
      'publishedAt',
      'title',
      'views',
      'likesCount',
      'dislikesCount',
      'sidebarOrder',
      'status',
      'tier'
    ];

    if (!whitelist.includes(field)) {
      return { createdAt: 'desc' };
    }

    return { [field]: dir };
  }
}
