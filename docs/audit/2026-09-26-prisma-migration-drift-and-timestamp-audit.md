# 2026-09-26 — Prisma schema/migration drift reconciliation + migration timestamp audit

Covers `PRISMA-SCHEMA-MIGRATION-DRIFT-001` and `PRISMA-MIGRATION-TIMESTAMP-DEDUP-001`.

## PRISMA-SCHEMA-MIGRATION-DRIFT-001 — resolved

Reproduced the drift from scratch: initialized a throwaway local Postgres 16
instance, ran `prisma migrate deploy` against it (all 40 migration folders
present at the time, in lexical order), then ran
`prisma migrate diff --from-url <that db> --to-schema-datamodel
prisma/schema.prisma --script`. The diff matched the ticket's reproduction
exactly:

- 7 indexes declared in `schema.prisma` that no migration ever created
  (`Comment` x2, `PatronGrant`, `Payment`, `Video` x3).
- One index a migration created (`VideoPlaybackSession_createdAt_idx`,
  from `20260607000000_fix_schema_consistency`) that `schema.prisma` no
  longer declares — superseded by the more targeted indexes already on that
  model (`startedAt`, `countedAsView`, etc.).
- Nullable/default drift on `BroadcastEmail`, `EmailEvent`, `VideoOriginal`,
  and `VideoPlaybackSession` (all loosening except one field — see below).
- `Notification_userId_fkey` / `NotificationPreference_userId_fkey` created
  without an explicit `ON UPDATE` action, defaulting to `NO ACTION`.
  Queried `pg_constraint.confupdtype` for every FK in the migrated schema:
  every other relation is `'c'` (cascade); these two are the only `'a'`
  (no action) outliers — confirms this is real drift, not an intentional
  difference.

**The one risk-bearing change** — `VideoPlaybackSession.maxProgressMs` going
from nullable/no-default to `NOT NULL DEFAULT 0` — was verified against
simulated pre-existing NULL data before shipping the migration: applied the
first 40 migrations to a fresh DB, inserted a row with `maxProgressMs = NULL`
directly (bypassing Prisma, the way an already-affected production row would
exist), then ran the new fix migration. It succeeded: the row was backfilled
to `0` and the column is now `NOT NULL DEFAULT 0`, matching `schema.prisma`.
Every other nullable/default change in this drift only loosens a constraint
(`DROP NOT NULL`, `DROP DEFAULT`, or a new `DEFAULT` for future rows only),
which cannot fail against existing data.

**No access to the real production database was available in this
environment** — per the ticket's own scope item 1, this reconciliation was
verified via a from-scratch replay of the full migration history (the same
process that built every real environment, since `prisma migrate deploy`
applies files in lexical order and no environment is known to have applied
them out of order), not by querying production directly. The backfill step
in the new migration makes this safe regardless: it runs `UPDATE ... SET
"maxProgressMs" = 0 WHERE "maxProgressMs" IS NULL` before tightening the
column, so the migration cannot fail on production data whether or not any
row currently has a NULL there.

Fix landed as three new, additive-only migrations (existing migration files
were not touched):

- `prisma/migrations/20260926120000_add_missing_schema_indexes/` — the 7
  missing `CREATE INDEX` statements, plus the one `DROP INDEX` for the index
  `schema.prisma` no longer declares.
- `prisma/migrations/20260926120001_reconcile_notification_fk_onupdate/` —
  drops and recreates the two `Notification*` foreign keys with
  `ON UPDATE CASCADE`, matching every other relation.
- `prisma/migrations/20260926120002_reconcile_schema_nullable_default_drift/`
  — the `BroadcastEmail`/`EmailEvent`/`VideoOriginal`/`VideoPlaybackSession`
  column changes, with the `maxProgressMs` backfill described above.

Re-ran the same clean-DB reconstruction after applying these three
migrations: `prisma migrate diff` against `schema.prisma` now returns an
empty migration — zero remaining drift.

Not investigated further (per the ticket's own non-goals): which past
commit originally hand-edited `schema.prisma` without a matching migration.

## PRISMA-MIGRATION-TIMESTAMP-DEDUP-001 — audited, no migration file changes

Confirmed the two timestamp collisions the ticket describes are still
present and unchanged:

- 3-way: `20260620000000_add_comment_is_hearted`,
  `20260620000000_payment_request_id`,
  `20260620000000_video_publish_after_asset_ready`.
- 2-way: `20260628000000_add_mux_vimeo_pending_primary`,
  `20260628000000_remove_referral_system`.

And confirmed the `Payment.requestId` duplication: both
`20260620000000_payment_request_id` and `20260625121500_add_payment_request_id`
add the same column and unique index, both via `ADD COLUMN IF NOT EXISTS` /
`CREATE UNIQUE INDEX IF NOT EXISTS` — genuinely idempotent, confirmed by
successfully applying all 40 migrations (including both) in sequence against
a clean database with no error.

Per the ticket's own scope: this environment has no access to a real
`DATABASE_URL` for staging/production, so `prisma migrate status` could not
be run against a real environment to check whether any environment applied
these in an order other than today's lexical directory order. The safe
default — confirmed by a from-scratch `prisma migrate deploy`, which is the
only process any real environment is known to use (`CLAUDE.md` §3) — is that
every environment applies `prisma/migrations/` in lexical order, so the
current directory order **is** the applied order everywhere; there is no
evidence of a divergent applied order to reconcile.

**No migration files were renamed or removed.** Per `CLAUDE.md` §3 and this
ticket's own invariants, Prisma tracks applied migrations by directory name
in `_prisma_migrations`, and renaming an already-applied migration folder
breaks that tracking on any environment that already applied it. This
finding remains historical/documentation-only, exactly as the ticket
anticipated for the case where no environment has a divergent applied order
to fix: nothing here is broken today, and there is nothing safe to
change without a database reset or a deliberate future migration in the
same area (per the ticket's scope item 3) — not something to do in
isolation.
