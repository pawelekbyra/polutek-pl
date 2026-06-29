-- Add optional name column back to EmailTemplate (was dropped in refactor but still referenced in schema)
ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "name" TEXT;
