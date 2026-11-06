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

export function toPublicCommentAuthor(author?: PublicCommentAuthor | null, videoCreatorId?: string | null, options: { isVip?: boolean; isBase?: boolean } = {}) {
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

  // No supporter ("patron") badge: a voluntary tip never buys any public distinction. "VIP" comes only from an active
  // PAID patron-zone access, decided by the caller (`isVip`, from `listVipUserIds`), never from a tip or PatronGrant.
  const badges: Array<"ADMIN" | "AUTHOR" | "VIP" | "BASE"> = [];
  if (author.role === 'ADMIN') badges.push("ADMIN");
  if (videoCreatorId && author.id === videoCreatorId) badges.push("AUTHOR");
  if (options.isVip === true) badges.push("VIP");
  // "BASE" only for an author who is neither the creator nor VIP, and only when the caller knows who is VIP.
  if (options.isBase === true && !badges.includes("AUTHOR") && !badges.includes("VIP")) badges.push("BASE");

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
