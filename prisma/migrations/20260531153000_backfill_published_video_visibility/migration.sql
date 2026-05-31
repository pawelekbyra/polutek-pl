-- Legacy published videos created before publishedAt existed/was enforced should remain visible.
UPDATE "Video"
SET "publishedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "status" = 'PUBLISHED'
  AND "publishedAt" IS NULL;

-- Ensure the canonical seeded/admin creator is visible when present.
UPDATE "Creator"
SET "isApproved" = TRUE,
    "isPrimary" = TRUE
WHERE "slug" = 'polutek';
