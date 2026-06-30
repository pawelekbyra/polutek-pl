-- Remove legacy Patron cache columns from User.
-- Patron status is derived exclusively from active PatronGrant rows.
-- Safe to run after deploying code that no longer reads or writes these columns.

ALTER TABLE "User" DROP COLUMN IF EXISTS "isPatron";
ALTER TABLE "User" DROP COLUMN IF EXISTS "patronSince";
ALTER TABLE "User" DROP COLUMN IF EXISTS "patronSource";
