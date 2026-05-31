import { VideoStatus, AccessTier, Prisma } from '@prisma/client';

const visiblePublishedAtFilter = (now: Date): Prisma.VideoWhereInput => ({
  OR: [
    { publishedAt: null },
    { publishedAt: { lte: now } },
  ],
});

function buildPublicVideoWhere(now: Date = new Date()): Prisma.VideoWhereInput {
  return {
    status: VideoStatus.PUBLISHED,
    creator: {
      isApproved: true,
    },
    ...visiblePublishedAtFilter(now),
  };
}

console.log(JSON.stringify(buildPublicVideoWhere(), null, 2));
