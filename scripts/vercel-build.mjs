// Vercel build entry point (package.json `vercel-build`, vercel.json `buildCommand`).
//
// Database migrations run ONLY for production builds (and for local/unknown environments,
// which keeps the old behavior of `npm run vercel-build`). Preview builds must never migrate:
// in this project the preview environment points at the same Neon database as production, so a
// PR preview that applied its migration would change the real schema before the PR is merged,
// and a bad migration would leave `_prisma_migrations` in a failed state that blocks every
// later deploy (this happened on 2026-09-30 with a migration file that started with a BOM).
// Migrations are still fully exercised by the `integration-postgres` CI job.
import { spawnSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV;
const skipMigrations = vercelEnv === "preview" || vercelEnv === "development";

function run(command) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (skipMigrations) {
  console.log(`[vercel-build] VERCEL_ENV=${vercelEnv}: skipping db:migrate:repair and db:migrate:deploy.`);
} else {
  run("npm run db:migrate:repair");
  run("npm run db:migrate:deploy");
}

run("npm run db:generate");
run("next build");
