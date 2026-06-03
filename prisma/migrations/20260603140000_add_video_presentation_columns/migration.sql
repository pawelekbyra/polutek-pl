-- Add video presentation controls previously applied by runtime schema healing.
ALTER TABLE "Video" ADD COLUMN "showInSidebar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Video" ADD COLUMN "sidebarOrder" INTEGER NOT NULL DEFAULT 0;
