-- Scheduled premieres (CLAUDE.md "Premieres"). Additive and idempotent.
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "premiereAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Video_premiereAt_idx" ON "Video"("premiereAt");
