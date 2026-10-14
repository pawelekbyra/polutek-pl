import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Stage 8, deployment B (CLAUDE.md 4.24): Creator.isApproved / Creator.isPrimary and MAIN_CREATOR_SLUG are gone.
// Guards against re-introducing them. Historical migrations, docs and tests are intentionally not scanned.

const ROOT = process.cwd();
const MIGRATION = path.join(ROOT, "prisma/migrations/20261014120000_drop_creator_legacy_flags/migration.sql");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".sql"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage", "dist"]);

function walk(target: string, out: string[]): void {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (EXTENSIONS.has(path.extname(target))) out.push(target);
    return;
  }
  for (const name of fs.readdirSync(target)) {
    if (!SKIP_DIRS.has(name)) walk(path.join(target, name), out);
  }
}

/** A line that is only a comment (// ..., * ..., /* ..., -- ... in SQL, # in shell): historical notes are allowed. */
const isCommentLine = (line: string) => /^\s*(\/\/|\*|\/\*|--|#)/.test(line);

describe("stage 8 deployment B: legacy channel flags are removed", () => {
  it("model Creator has no isApproved or isPrimary field (VideoAsset.isPrimary is a different field)", () => {
    const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
    const block = schema.match(/^model Creator \{[\s\S]*?^\}/m)?.[0] ?? "";
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/^\s*isApproved\b/m);
    expect(block).not.toMatch(/^\s*isPrimary\b/m);
    const asset = schema.match(/^model VideoAsset \{[\s\S]*?^\}/m)?.[0] ?? "";
    expect(asset).toMatch(/^\s*isPrimary\b/m);
  });

  it("production code does not mention isApproved or MAIN_CREATOR_SLUG outside comments", () => {
    const files: string[] = [];
    for (const dir of ["lib", "app", "apps", "scripts"]) walk(path.join(ROOT, dir), files);
    walk(path.join(ROOT, "middleware.ts"), files);
    expect(files.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of files) {
      fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
        if (/\bisApproved\b|MAIN_CREATOR_SLUG/.test(line) && !isCommentLine(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the channel repository resolves the main channel only from the setting (no emergency fallbacks)", () => {
    const source = fs.readFileSync(path.join(ROOT, "lib/modules/channel/infrastructure/channel.repository.ts"), "utf8");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("findFirst");
    expect(source).not.toMatch(/isPrimary/);
  });
});

describe("migration 20261014120000_drop_creator_legacy_flags (CLAUDE.md 4.0: destructive, guarded)", () => {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const executable = sql.split(/\r?\n/).filter((line) => !line.trim().startsWith("--")).join("\n");

  it("has no BOM", () => {
    expect(fs.readFileSync(MIGRATION).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
  });

  it("drops exactly the two Creator columns, without CASCADE and without touching other tables", () => {
    const drops = executable.match(/\bDROP\s+\w+/gi) ?? [];
    expect(drops.every((d) => /DROP\s+COLUMN/i.test(d))).toBe(true);
    expect(executable).toMatch(/ALTER TABLE "Creator" DROP COLUMN "isPrimary", DROP COLUMN "isApproved";/);
    expect(executable).not.toMatch(/\bCASCADE\b/i);
    expect(executable).not.toMatch(/\b(DELETE|TRUNCATE|UPDATE|INSERT)\b/i);
  });

  it("aborts before dropping when channels exist but the main_channel_id setting is missing", () => {
    expect(executable).toMatch(/main_channel_id missing: run deployment A first/);
    expect(executable.indexOf("RAISE EXCEPTION")).toBeGreaterThan(-1);
    expect(executable.indexOf("RAISE EXCEPTION")).toBeLessThan(executable.indexOf("DROP COLUMN"));
    expect(executable).toMatch(/EXISTS \(SELECT 1 FROM "Creator"\)/);
  });
});
