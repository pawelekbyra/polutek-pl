-- Comment mute for moderation (admin panel, Społeczność). Additive and idempotent: safe to re-run.
-- Until "commentMutedUntil" the account may read and react but createVideoComment refuses new comments.
-- Null (the default for every existing row) means not muted. No data is rewritten.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commentMutedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commentMuteReason" TEXT;
