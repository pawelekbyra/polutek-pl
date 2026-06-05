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

export function toPublicCommentAuthor(author?: PublicCommentAuthor | null) {
  if (!author) return null;

  return {
    id: author.id,
    name: author.name,
    username: author.username,
    imageUrl: author.imageUrl,
    isPatron: author.isPatron,
    role: author.role,
  };
}
