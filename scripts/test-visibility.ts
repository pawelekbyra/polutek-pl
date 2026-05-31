import { VideoStatus, AccessTier } from '@prisma/client';

const visiblePublishedAtFilter = (now: Date) => ({
  OR: [
    { publishedAt: null },
    { publishedAt: { lte: now } },
  ],
});

function buildPublicVideoWhere(now: Date = new Date()) {
  return {
    status: VideoStatus.PUBLISHED,
    creator: {
      isApproved: true,
    },
    ...visiblePublishedAtFilter(now),
  };
}

function test() {
    const now = new Date();
    const where = buildPublicVideoWhere(now);
    console.log("Where clause:", JSON.stringify(where, null, 2));

    // Test cases (conceptual)
    const videos = [
        { status: VideoStatus.PUBLISHED, creator: { isApproved: true }, publishedAt: null },
        { status: VideoStatus.PUBLISHED, creator: { isApproved: true }, publishedAt: new Date(now.getTime() - 1000) },
        { status: VideoStatus.PUBLISHED, creator: { isApproved: true }, publishedAt: new Date(now.getTime() + 1000) },
        { status: VideoStatus.DRAFT, creator: { isApproved: true }, publishedAt: null },
        { status: VideoStatus.PUBLISHED, creator: { isApproved: false }, publishedAt: null },
    ];

    console.log("\nResults:");
    videos.forEach((v, i) => {
        const statusMatch = v.status === VideoStatus.PUBLISHED;
        const creatorMatch = v.creator.isApproved === true;
        const pubAtMatch = v.publishedAt === null || v.publishedAt <= now;
        const visible = statusMatch && creatorMatch && pubAtMatch;
        console.log(`Video ${i}: ${visible ? 'VISIBLE' : 'HIDDEN'} (status: ${v.status}, approved: ${v.creator.isApproved}, pubAt: ${v.publishedAt})`);
    });
}

test();
