import { Prisma } from '@prisma/client';
import { isGeneratedLegacyUsername } from '@/lib/utils/auth';
import { DELETED_COMMENT_AUTHOR_NAME } from '@/lib/modules/comments/domain/comment-frontend.dto';

export const publicCommentAuthorSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  username: true,
  imageUrl: true,
  isDeleted: true,
  role: true,
});

export type PublicCommentAuthor = Prisma.UserGetPayload<{ select: typeof publicCommentAuthorSelect }>;

export function toPublicCommentAuthor(author?: PublicCommentAuthor | null, videoCreatorId?: string | null) {
  if (!author) return null;

  if (author.isDeleted) {
    return {
      id: author.id,
      displayName: DELETED_COMMENT_AUTHOR_NAME,
      username: null,
      imageUrl: null,
      badges: [],
    };
  }

  // No supporter ("patron") badge: a voluntary tip never buys any public distinction.
  const badges: Array<"ADMIN" | "AUTHOR"> = [];
  if (author.role === 'ADMIN') badges.push("ADMIN");
  if (videoCreatorId && author.id === videoCreatorId) badges.push("AUTHOR");

  const rawName = author.name?.trim();
  const name = rawName && !isGeneratedLegacyUsername(rawName) ? rawName : null;
  const rawUsername = author.username?.trim();
  const username = rawUsername && !isGeneratedLegacyUsername(rawUsername) ? rawUsername : null;
  const displayName = name || username || "Użytkownik";

  return {
    id: author.id,
    displayName,
    // Filtered value only: the raw column can hold a generated id (`user_…`, `deleted_…`).
    username,
    imageUrl: author.imageUrl,
    badges,
  };
}
