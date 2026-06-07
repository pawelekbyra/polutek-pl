import { Prisma } from '@prisma/client';

export const publicCommentAuthorSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  username: true,
  imageUrl: true,
  isPatron: true,
  role: true,
});

type PublicCommentAuthor = Prisma.UserGetPayload<{ select: typeof publicCommentAuthorSelect }>;

import { isGeneratedClerkUsername } from '@/lib/utils/auth';

export function toPublicCommentAuthor(author?: PublicCommentAuthor | null, videoCreatorId?: string | null) {
  if (!author) return null;

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
