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

export function toPublicCommentAuthor(author?: PublicCommentAuthor | null, videoCreatorId?: string | null) {
  if (!author) return null;

  const badges: Array<"ADMIN" | "PATRON" | "AUTHOR"> = [];
  if (author.role === 'ADMIN') badges.push("ADMIN");
  if (author.isPatron) badges.push("PATRON");

  // If we have a videoCreatorId, we can check if this author is the video author
  // This might need more logic if we want to show 'AUTHOR' badge
  // For now, let's just return the basic info as requested in DTO

  return {
    id: author.id,
    name: author.name,
    username: author.username,
    imageUrl: author.imageUrl,
    isPatron: author.isPatron,
    role: author.role,
    badges,
  };
}
