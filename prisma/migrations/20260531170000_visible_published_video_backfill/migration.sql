-- Preserve the hardening that disables demo fallbacks by making legacy published DB content visible.
UPDATE "Video"
SET "publishedAt" = COALESCE("publishedAt", "createdAt", NOW())
WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL;

-- The single-channel production setup expects the POLUTEK.PL creator to be approved/primary.
UPDATE "Creator"
SET "isApproved" = TRUE,
    "isPrimary" = TRUE
WHERE "slug" = 'polutek';
