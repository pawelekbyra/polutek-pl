-- Per-language notification rendering: a key of the template and its placeholder values. Both columns are nullable and
-- additive: old rows keep working from titlePl/titleEn/bodyPl/bodyEn (the fallback every row still carries).
ALTER TABLE "Notification" ADD COLUMN "templateKey" TEXT, ADD COLUMN "params" JSONB;
