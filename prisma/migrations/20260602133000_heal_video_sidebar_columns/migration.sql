-- Idempotently heal production databases that missed the presentation-column migration.
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "showInSidebar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "sidebarOrder" INTEGER NOT NULL DEFAULT 0;
