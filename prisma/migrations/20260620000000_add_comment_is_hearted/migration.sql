-- Add moderator heart state to comments.
ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "isHearted" BOOLEAN NOT NULL DEFAULT false;
