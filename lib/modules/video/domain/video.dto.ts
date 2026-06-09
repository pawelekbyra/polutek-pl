import { AccessTier, VideoStatus } from "@prisma/client";

export interface PublicVideoDto {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  videoUrl: string;
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

export interface AdminVideoDto extends PublicVideoDto {
  status: VideoStatus;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  commentsCount: number;
}

export function toPublicVideoDto(video: any): PublicVideoDto {
  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    titleEn: video.titleEn,
    description: video.description,
    descriptionEn: video.descriptionEn,
    videoUrl: video.videoUrl,
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
}

export function toAdminVideoDto(video: any): AdminVideoDto {
  return {
    ...toPublicVideoDto(video),
    status: video.status,
    creatorId: video.creatorId,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    commentsCount: video._count?.comments || video.commentsCount || 0,
  };
}
