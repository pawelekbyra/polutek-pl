-- Database role of the admin panel (docs/architecture/admin-phase3.md, "Rola bazy pp_admin").
-- Run ONCE by the operator as the database owner, after the migration 20261005200000 has created the NOLOGIN role
-- (or create it yourself: CREATE ROLE pp_admin LOGIN PASSWORD '...'). Idempotent: safe to run again after new tables.
--
--   docker compose exec -T db psql -U <owner> -d <db> -v ON_ERROR_STOP=1 -f - < pp-admin-role.sql
--   docker compose exec db psql -U <owner> -d <db> -c "ALTER ROLE pp_admin LOGIN PASSWORD '<generated>'"
--   then in admin.env: DATABASE_URL=postgresql://pp_admin:<generated>@db:5432/<db>   (restart the admin container)
--
-- What the panel may do: everything the use cases do (read/write the domain), but NEVER rewrite or delete the audit
-- trail, and never touch the migration table, telemetry or other schemas. The site keeps its own owner role.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pp_admin') THEN
    CREATE ROLE pp_admin NOLOGIN;
  END IF;
END $$;

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO pp_admin', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO pp_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pp_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pp_admin;

-- The audit trail: append and read only. (The triggers of migration 20261005200000 and 20261004200000 refuse
-- tampering for every role; REVOKE makes the role unable to even try.)
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM pp_admin;
REVOKE UPDATE, DELETE, TRUNCATE ON "AdminAuthEvent" FROM pp_admin;

-- Never the migration bookkeeping.
REVOKE ALL ON "_prisma_migrations" FROM pp_admin;

-- Tables created by later migrations get the same grants (the migration user owns them).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pp_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pp_admin;
-- ...but a new table never silently becomes writable for the audit tables' siblings: re-run this script after a migration
-- that adds an audit-like table and add its REVOKE above.

-- Check (expect two rows with false/false):
--   SELECT has_table_privilege('pp_admin','"AuditLog"','UPDATE'), has_table_privilege('pp_admin','"AuditLog"','DELETE');
