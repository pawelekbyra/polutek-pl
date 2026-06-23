import { Prisma } from '@prisma/client';

export const publicCommentAuthorSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  username: true,
  imageUrl: true,
  isPatron: true,
  isDeleted: true,
  role: true,
});

type PublicCommentAuthor = Prisma.UserGetPayload<{ select: typeof publicCommentAuthorSelect }>;

import { isGeneratedClerkUsername } from '@/lib/utils/auth';

/**
 * Maps a user record to a public comment author DTO.
 *
 * NOTE ON BADGE TRUTH:
 * The "PATRON" badge is derived from the denormalized `User.isPatron` field.
 * This is for DECORATIVE DISPLAY ONLY and may be stale. It must NEVER be used
 * for access control. The backend ignores this field for authorization.
 */
export function toPublicCommentAuthor(author?: PublicCommentAuthor | null, videoCreatorId?: string | null) {
  if (!author) return null;

  if (author.isDeleted) {
    return {
      id: author.id,
      displayName: "Usunięty Użytkownik",
      username: null,
      imageUrl: null,
      badges: [],
    };
  }

  const badges: Array<"ADMIN" | "PATRON" | "AUTHOR"> = [];
  if (author.role === 'ADMIN') badges.push("ADMIN");
  if (author.isPatron) badges.push("PATRON");
  if (videoCreatorId && author.id === videoCreatorId) badges.push("AUTHOR");

  const rawName = author.name?.trim();
  const name = rawName && !isGeneratedClerkUsername(rawName) ? rawName : null;
  const rawUsername = author.username?.trim();
  const username = rawUsername && !isGeneratedClerkUsername(rawUsername) ? rawUsername : null;
  const displayName = name || username || "Użytkownik";

  return {
    id: author.id,
    displayName,
    username: author.username,
    imageUrl: author.imageUrl,
    badges,
  };
}
