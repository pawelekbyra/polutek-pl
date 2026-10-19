-- Playlists: creator-curated, ordered lists of one channel's videos (docs/architecture/playlists.md).
-- Additive only: a new enum and two new tables, nothing existing is changed or dropped.

-- CreateEnum
CREATE TYPE "PlaylistVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "PlaylistVisibility" NOT NULL DEFAULT 'PUBLIC',
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Playlist_channelId_deletedAt_visibility_idx" ON "Playlist"("channelId", "deletedAt", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_channelId_slug_key" ON "Playlist"("channelId", "slug");

-- CreateIndex
CREATE INDEX "PlaylistItem_playlistId_position_idx" ON "PlaylistItem"("playlistId", "position");

-- CreateIndex
CREATE INDEX "PlaylistItem_videoId_idx" ON "PlaylistItem"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistItem_playlistId_videoId_key" ON "PlaylistItem"("playlistId", "videoId");

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
