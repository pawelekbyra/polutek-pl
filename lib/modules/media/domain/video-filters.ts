import { Prisma, VideoStatus } from "@prisma/client";

export const visiblePublishedAtFilter = (now: Date): Prisma.VideoWhereInput => ({
  OR: [
    { publishedAt: null },
    { publishedAt: { lte: now } },
  ],
});
