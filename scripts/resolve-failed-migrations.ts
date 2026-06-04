import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const ROLLBACK_SAFE_FAILED_MIGRATIONS = new Set([
  // This migration is idempotent in the repository. Some production deployments
  // failed while applying its original non-idempotent form, which leaves Prisma in
  // P3009 until it is explicitly marked rolled back and retried.
  '20260603120000_add_comment_pinning',
]);

type FailedMigrationRow = {
  migration_name: string;
  started_at: Date;
  logs: string | null;
};

const prisma = new PrismaClient();

async function main() {
  let failedMigrations: FailedMigrationRow[] = [];

  try {
    failedMigrations = await prisma.$queryRaw<FailedMigrationRow[]>`
      SELECT migration_name, started_at, logs
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at ASC
    `;
  } catch (error: any) {
    // Fresh databases do not have _prisma_migrations yet; migrate deploy will create it.
    if (error?.code === 'P2021' || String(error?.message || '').includes('_prisma_migrations')) {
      console.log('[MIGRATION_REPAIR] No _prisma_migrations table found; skipping repair preflight.');
      return;
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }

  if (failedMigrations.length === 0) {
    console.log('[MIGRATION_REPAIR] No failed migrations found.');
    return;
  }

  const unknown = failedMigrations.filter(
    (migration) => !ROLLBACK_SAFE_FAILED_MIGRATIONS.has(migration.migration_name),
  );

  if (unknown.length > 0) {
    console.error('[MIGRATION_REPAIR] Found failed migrations that are not approved for automatic repair:');
    for (const migration of unknown) {
      const startedAt = migration.started_at instanceof Date ? migration.started_at.toISOString() : String(migration.started_at);
      console.error(`- ${migration.migration_name} started at ${startedAt}`);
      if (migration.logs) console.error(migration.logs);
    }
    console.error('Resolve these manually with a database backup and Prisma migrate resolve before deploying.');
    process.exit(1);
  }

  for (const migration of failedMigrations) {
    console.log(`[MIGRATION_REPAIR] Marking ${migration.migration_name} as rolled back so migrate deploy can retry the idempotent migration.`);
    execFileSync('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', migration.migration_name], {
      stdio: 'inherit',
      env: process.env,
    });
  }
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => undefined);
  console.error('[MIGRATION_REPAIR] Failed to inspect or repair Prisma migration state.');
  console.error(error);
  process.exit(1);
});
