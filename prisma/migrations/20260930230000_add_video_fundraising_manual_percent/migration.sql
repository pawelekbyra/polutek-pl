-- Hand-set fill of the fundraising bar, 0-100 (CLAUDE.md "Fundraising progress bar"). Additive and idempotent.
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "fundraisingManualPercent" INTEGER;
