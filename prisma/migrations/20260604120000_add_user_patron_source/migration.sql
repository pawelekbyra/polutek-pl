-- Add explicit Patron source metadata to the User source-of-truth fields.
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'STRIPE_TIP';
ALTER TYPE "PatronGrantSource" ADD VALUE IF NOT EXISTS 'MIGRATION';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patronSource" "PatronGrantSource";
