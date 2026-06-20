#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const env = { ...process.env };

if (!env.DATABASE_URL_UNPOOLED && env.DATABASE_URL) {
  env.DATABASE_URL_UNPOOLED = env.DATABASE_URL;
  console.warn(
    "[vercel-build] DATABASE_URL_UNPOOLED is not set; falling back to DATABASE_URL for Prisma directUrl. " +
      "Configure DATABASE_URL_UNPOOLED in Vercel for production-grade migrations."
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "db:migrate:deploy"]);
run("npm", ["run", "db:generate"]);
run("npm", ["run", "build"]);
