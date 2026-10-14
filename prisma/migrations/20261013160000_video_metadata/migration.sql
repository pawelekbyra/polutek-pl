-- Video metadata a creator can set in the Studio: tags, category, comments mode.
-- Additive only: every existing row keeps its meaning (no tags, no category, comments ON).

-- CreateEnum
CREATE TYPE "VideoCommentsMode" AS ENUM ('ON', 'HELD', 'OFF');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "category" TEXT,
ADD COLUMN     "commentsMode" "VideoCommentsMode" NOT NULL DEFAULT 'ON',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- The count is the one limit worth a database guarantee (the 30-character limit per tag lives in the application).
ALTER TABLE "Video" ADD CONSTRAINT "Video_tags_max_15_check" CHECK (cardinality("tags") <= 15);
