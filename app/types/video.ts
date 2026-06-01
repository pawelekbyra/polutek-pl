import { AccessTier, VideoStatus } from "@prisma/client";

export interface Creator {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  subscribersCount: number;
}

/**
 * Internal/admin-only video shape.
 * Do not use this type in public frontend components.
 * Public UI must use PublicVideoDTO.
 */
export type AdminVideoDTO = {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description?: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  showInSidebar: boolean;
  sidebarOrder: number;
  publishedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator?: Creator;
  _count?: {
    videoLikes: number;
    videoDislikes: number;
    comments: number;
  };
};

export interface InternalVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description?: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  publishedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  creator?: Creator;
}

export interface PublicCreatorDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  subscribersCount: number;
}

export type PublicCreatorPageDTO = PublicCreatorDTO & {
  bio?: string | null;
  bannerUrl?: string | null;
  userId?: string;
  videos: PublicVideoDTO[];
};

export interface PublicVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  publishedAt?: Date | string | null;
  creator?: PublicCreatorDTO;
}

export interface PlaybackDTO {
  playbackUrl: string;
  expiresAt?: string;
  contentType?: string;
}
