import { AccessTier } from "@prisma/client";

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

export interface Video {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description?: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
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

export interface PublicVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
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
