import { AccessTier, VideoStatus } from "@prisma/client";
import type { VideoAccessTier } from "@/lib/access-tier";

export interface Creator {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  subscribersCount: number;
}

/**
 * Internal/admin-only video shape.
 * Do not use this type in public frontend components.
 * Public UI must use PublicVideoDTO.
 */
export interface InternalVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  titleEn?: string | null;
  slug: string;
  description?: string | null;
  descriptionEn?: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  sidebarOrder?: number;
  publishedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  creator?: Creator;
}

export type VideoTextTrackDTO = {
  src: string;
  label: string;
  language: string;
  kind: 'subtitles' | 'captions';
  default?: boolean;
};

export interface PublicCreatorDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  subscribersCount: number;
}

export type PublicCreatorPageDTO = PublicCreatorDTO & {
  bio?: string | null;
  userId?: string;
  videos: PublicVideoDTO[];
};

export interface PublicVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  titleEn?: string | null;
  slug: string;
  description?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  /** Effective access level (lib/access-tier.ts): anything that is not PUBLIC arrives as LOGGED_IN. */
  tier: VideoAccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  sidebarOrder?: number;
  publishedAt?: Date | string | null;
  /** ISO time of a scheduled premiere, or null. Upcoming iff in the future (see lib/premiere.ts). */
  premiereAt?: string | null;
  /**
   * Share of the video's fundraising goal reached, 0..1 (whole percents), or null/absent
   * when it has no goal. Never an amount: goals and totals stay server-side.
   */
  fundraisingProgress?: number | null;
  creator?: PublicCreatorDTO;
  // Subtitles are not part of the public DTO: they come only with a playable plan.
  // Ensure no raw fields are present
  videoUrl?: never;
  sourceUrl?: never;
  rawUrl?: never;
}

export interface PlaybackDTO {
  playbackUrl: string;
  expiresAt?: string;
  contentType?: string;
}
