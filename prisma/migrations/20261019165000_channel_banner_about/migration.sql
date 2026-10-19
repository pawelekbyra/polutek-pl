-- Channel page: banner image and "About" data (additive only, CLAUDE.md channel page).
ALTER TABLE "Creator" ADD COLUMN "bannerUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Creator" ADD COLUMN "links" JSONB;
ALTER TABLE "Creator" ADD COLUMN "publicContactEmail" TEXT;

CREATE TABLE "ChannelBanner" (
    "channelId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelBanner_pkey" PRIMARY KEY ("channelId")
);

ALTER TABLE "ChannelBanner" ADD CONSTRAINT "ChannelBanner_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
