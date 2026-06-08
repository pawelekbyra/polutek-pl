import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const disabledMigrationMessage =
  "Legacy migration disabled: Subscription must not grant Patron access";
const productionAndMigrationRoots = ["app", "lib", "scripts"];
const sourceFilePattern = /\.(ts|tsx)$/;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(join(repoRoot, dir)).flatMap((entry) => {
    const relativePath = join(dir, entry);
    const fullPath = join(repoRoot, relativePath);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) return collectSourceFiles(relativePath);
    if (!sourceFilePattern.test(entry)) return [];
    return [relativePath];
  });
}

describe("Subscription to Patron guard", () => {
  it("keeps the legacy migrate-patrons script hard-disabled", () => {
    const script = readFileSync(
      join(repoRoot, "scripts/migrate-patrons.ts"),
      "utf8",
    ).trim();

    expect(script).toBe(`throw new Error("${disabledMigrationMessage}");`);
  });

  it("does not allow production or migration code to grant Patron access from Subscription records", () => {
    const checkedFiles =
      productionAndMigrationRoots.flatMap(collectSourceFiles);
    const unsafeGrantPatterns = [
      /grantPatronStatus\s*\(/,
      /isPatron\s*:\s*true/,
      /patronSince\s*:/,
      /patronSource\s*:/,
    ];

    const violations = checkedFiles.flatMap((file) => {
      const source = readFileSync(join(repoRoot, file), "utf8");
      if (!source.toLowerCase().includes("subscription")) return [];
      if (file.includes("admin") || file.includes("profile.service.ts")) return []; // Allow admin and profile services to use these fields

      return unsafeGrantPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${file} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });
});
