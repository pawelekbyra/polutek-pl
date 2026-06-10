import { AccessTier, VideoStatus } from "@prisma/client";

export interface BaseVideoDto {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  views: number;
  likesCount: number;
  dislikesCount: number;
  publishedAt: Date | null;
  isMainFeatured: boolean;
  showInSidebar: boolean;
  sidebarOrder: number;
}

export interface PublicVideoDto extends BaseVideoDto {
  videoUrl?: never;
  sourceUrl?: never;
  rawUrl?: never;
  providerUrl?: never;
}

export interface AdminVideoDto extends BaseVideoDto {
  videoUrl: string;
  status: VideoStatus;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  commentsCount: number;
}

export function toPublicVideoDto(video: any): PublicVideoDto {
  const dto = {
    id: video.id,
    slug: video.slug,
    title: video.title,
    titleEn: video.titleEn,
    description: video.description,
    descriptionEn: video.descriptionEn,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    tier: video.tier,
    views: video.views,
    likesCount: video.likesCount,
    dislikesCount: video.dislikesCount,
    publishedAt: video.publishedAt,
    isMainFeatured: video.isMainFeatured,
    showInSidebar: video.showInSidebar,
    sidebarOrder: video.sidebarOrder,
  };

  // Strip any accidental sensitive fields if they exist in the input object
  const forbidden = ['videoUrl', 'sourceUrl', 'rawUrl', 'signedUrl', 'providerUrl', 's3Url', 'blobUrl'];
  for (const field of forbidden) {
      if (field in dto) delete (dto as any)[field];
  }

  return dto as PublicVideoDto;
}

export function toAdminVideoDto(video: any): AdminVideoDto {
  return {
    ...toPublicVideoDto(video),
    videoUrl: video.videoUrl,
    status: video.status,
    creatorId: video.creatorId,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    commentsCount: video._count?.comments || video.commentsCount || 0,
  };
}
