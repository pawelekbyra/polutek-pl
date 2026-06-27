-- Add YOUTUBE to StorageProvider enum (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'StorageProvider'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = '"StorageProvider"'::regtype
        AND enumlabel = 'YOUTUBE'
    ) THEN
      ALTER TYPE "StorageProvider" ADD VALUE 'YOUTUBE';
    END IF;
  END IF;
END $$;

-- Add externalVideoId and externalUrl columns to VideoAsset (idempotent)
ALTER TABLE "VideoAsset"
  ADD COLUMN IF NOT EXISTS "externalVideoId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalUrl"     TEXT;
