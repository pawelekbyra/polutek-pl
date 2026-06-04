import { AccessTier } from '@prisma/client';

export type CommentAccessUser = {
  isPatron?: boolean | null;
  referralPoints?: number | null;
  role?: string | null;
} | null | undefined;

export type CommentAccessState = {
  isLoggedIn: boolean;
  isPatronLike: boolean;
  isPatronGated: boolean;
  canComment: boolean;
};

export function isPatronLikeUser(user: CommentAccessUser): boolean {
  return user?.role === 'ADMIN' || user?.isPatron === true;
}

export function getCommentAccessState(
  user: CommentAccessUser,
  videoTier: AccessTier = AccessTier.PUBLIC,
): CommentAccessState {
  const isLoggedIn = !!user;
  const isPatronGated = videoTier === AccessTier.PATRON;
  const isPatronLike = isPatronLikeUser(user);

  return {
    isLoggedIn,
    isPatronLike,
    isPatronGated,
    canComment: isLoggedIn && (!isPatronGated || isPatronLike),
  };
}
