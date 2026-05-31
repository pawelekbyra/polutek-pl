import { AccessTier, SystemRole, VideoStatus } from "@prisma/client";

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  role: SystemRole;
  isPatron: boolean;
  totalPaid: number;
  referralCount: number;
  referralPoints: number;
  referralCode?: string | null;
  language: string;
}

export interface CommentAuthor {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
}

export interface CommentWithAuthor {
  id: string;
  text: string;
  imageUrl?: string | null;
  authorId: string;
  author: CommentAuthor;
  videoId: string;
  parentId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isLiked?: boolean;
  isDisliked?: boolean;
  authorName: string;
  _count?: {
    likes: number;
    dislikes: number;
    replies: number;
  };
  replies: CommentWithAuthor[];
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
  createdAt: Date | string;
  updatedAt: Date | string;
}
