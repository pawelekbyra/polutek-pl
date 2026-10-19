-- One pinned comment per video, enforced by the database (the pin use case already unpins the previous one in the same
-- transaction; this makes a race between two simultaneous pins impossible). Partial index: Prisma's schema language
-- cannot express it, so it lives only here. Safe to add: no video has more than one pinned comment today.
CREATE UNIQUE INDEX "Comment_one_pinned_per_video" ON "Comment" ("videoId") WHERE "pinnedAt" IS NOT NULL;
