-- Reconciles schema.prisma with the applied migration history (PRISMA-SCHEMA-MIGRATION-DRIFT-001).
--
-- The Notification/NotificationPreference foreign keys were created without an
-- explicit ON UPDATE action (20260710000000_add_notification_model /
-- 20260710000100_add_notification_preferences_and_templates), so Postgres
-- defaulted them to NO ACTION on update. Every other `@relation` in
-- schema.prisma resolves to ON UPDATE CASCADE (Prisma's own default), and a
-- real DB confirms every other userId-style foreign key in this schema
-- already has confupdtype = 'c' — these two are the only outliers. Dropping
-- and recreating the constraint briefly removes referential integrity on
-- this column, but User.id is a stable UUID primary key that is never
-- updated in application code, so this is inert in practice; it only brings
-- these two FKs in line with schema.prisma and every other relation.
--
-- DROP CONSTRAINT IF EXISTS makes the drop safe regardless of whether the
-- constraint's current definition already matches (or differs from) what
-- this migration adds; the immediately-following ADD CONSTRAINT then always
-- starts from a clean, constraint-free column, so this is idempotent to
-- re-run and safe even if the real database's drift differs slightly from
-- the from-scratch replica this migration was verified against.

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationPreference" DROP CONSTRAINT IF EXISTS "NotificationPreference_userId_fkey";

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
