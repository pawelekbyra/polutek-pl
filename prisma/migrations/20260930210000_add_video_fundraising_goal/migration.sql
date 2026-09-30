-- Per-video fundraising goal (CLAUDE.md "Fundraising progress bar"). Additive and idempotent.
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "fundraisingGoalMinor" INTEGER;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "fundraisingGoalCurrency" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "fundraisingStartAt" TIMESTAMP(3);
