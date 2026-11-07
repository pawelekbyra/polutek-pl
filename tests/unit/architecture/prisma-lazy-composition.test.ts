import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("lazy Prisma composition", () => {
  it("uses the generated Prisma client through the default facade without connecting to a database", () => {
    const probe = `
      const { prisma } = require("./lib/prisma.ts");
      (async () => {
        if (typeof prisma.$transaction !== "function") throw new Error("missing transaction method");
        if (!("user" in prisma)) throw new Error("missing generated user delegate");
        await prisma.$disconnect();
        console.log("REAL_PRISMA_FACADE_OK");
      })().catch((error) => { console.error(error); process.exitCode = 1; });
    `;
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test" };
    delete env.DATABASE_URL;
    delete env.DATABASE_URL_UNPOOLED;

    const result = spawnSync(process.execPath, ["--import", "tsx", "-e", probe], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 15_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("REAL_PRISMA_FACADE_OK");
    expect(result.stderr).toBe("");
  });
});
