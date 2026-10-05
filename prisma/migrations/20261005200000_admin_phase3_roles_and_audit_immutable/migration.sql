-- Admin panel, phase 3 (docs/architecture/admin-phase3.md). Additive and idempotent.
--  1. AdminUser.role + AdminLanguageGrant: the TRANSLATOR role limited to chosen languages.
--  2. AuditLog becomes tamper-resistant: UPDATE only to blank ip/userAgent (the retention job's anonymization),
--     DELETE only for rows older than 400 days, no TRUNCATE. The same shape as AdminAuthEvent.
--  3. Database role pp_admin (NOLOGIN until the operator gives it a password): created when this migration may
--     do it, silently skipped otherwise. Grants are NOT part of the migration (they depend on the operator's
--     setup); run deploy/serwerek/admin/pp-admin-role.sql once. The panel works without the role.

ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'OWNER';

CREATE TABLE IF NOT EXISTS "AdminLanguageGrant" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'TRANSLATOR',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLanguageGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminLanguageGrant_adminUserId_language_key" ON "AdminLanguageGrant"("adminUserId", "language");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminLanguageGrant_adminUserId_fkey') THEN
    ALTER TABLE "AdminLanguageGrant" ADD CONSTRAINT "AdminLanguageGrant_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AuditLog: row trigger for UPDATE and DELETE.
CREATE OR REPLACE FUNCTION "audit_log_tamper_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The only legitimate change: the retention job blanking ip and userAgent (privacy, 90 days).
    IF (to_jsonb(OLD) - 'ip' - 'userAgent') = (to_jsonb(NEW) - 'ip' - 'userAgent')
       AND NEW."ip" IS NULL AND NEW."userAgent" IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'AuditLog is append-only (UPDATE refused)';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD."createdAt" > (now() - interval '400 days') THEN
      RAISE EXCEPTION 'AuditLog rows younger than 400 days cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "audit_log_tamper_guard" ON "AuditLog";
CREATE TRIGGER "audit_log_tamper_guard"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_tamper_guard"();

-- TRUNCATE bypasses row triggers, so it gets its own statement trigger.
CREATE OR REPLACE FUNCTION "audit_log_no_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog cannot be truncated';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "audit_log_no_truncate" ON "AuditLog";
CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_no_truncate"();

-- The panel's database role. Never fails the migration: without CREATEROLE the operator creates it by hand.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pp_admin') THEN
    CREATE ROLE pp_admin NOLOGIN;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Role pp_admin was not created (no CREATEROLE). Create it as described in docs/architecture/admin-phase3.md.';
END $$;
