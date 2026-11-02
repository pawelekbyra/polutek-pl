import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// `npm run logo -- <variant>`: one command to switch the header logo (owner request 2026-11-02).
const repo = process.cwd();
const script = path.join(repo, "scripts/brand/set-logo.mjs");
const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: "utf8" });
const currentVariant = (root: string) =>
  readFileSync(path.join(root, "lib/ui-flags.ts"), "utf8").match(/BRAND_LOGO_VARIANT: BrandLogoVariant = "([a-z-]+)"/)?.[1];

/** A throwaway checkout with just the files the script reads. */
function sandbox(): string {
  const root = mkdtempSync(path.join(tmpdir(), "set-logo-"));
  for (const f of [
    "lib/ui-flags.ts",
    "tests/unit/components/brand-name.test.tsx",
    "app/components/BrandName.tsx",
    "public/logo-glasses.svg",
    "app/components/brand/PolutekWordmark.tsx",
    "app/components/brand/polutek-wordmark-paths.ts",
    "public/brand/polutek-wordmark.svg",
    "app/components/brand/PolutekWordmarkBlue.tsx",
    "app/components/brand/polutek-wordmark-blue-paths.ts",
    "public/brand/polutek-wordmark-blue.svg",
    "app/components/brand/PolutekWordmarkBlueSymbol.tsx",
    "app/components/brand/polutek-symbol-paths.ts",
    "public/brand/polutek-wordmark-blue-symbol.svg",
  ]) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    cpSync(path.join(repo, f), path.join(root, f));
  }
  return root;
}

describe("scripts/brand/set-logo.mjs (npm run logo -- <variant>)", () => {
  const made: string[] = [];
  afterEach(() => made.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  it("is wired as `npm run logo`", () => {
    const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
    expect(pkg.scripts.logo).toBe("node scripts/brand/set-logo.mjs");
  });

  it("--dry-run on the real repo prints the change and writes nothing", () => {
    const live = currentVariant(repo)!;
    const target = live === "glasses" ? "wordmark-blue" : "glasses";
    const before = readFileSync(path.join(repo, "lib/ui-flags.ts"), "utf8");
    const r = run(target, "--dry-run");

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("--dry-run");
    expect(r.stdout).toContain(`"${live}" -> "${target}"`);
    expect(readFileSync(path.join(repo, "lib/ui-flags.ts"), "utf8")).toBe(before);
  });

  it("switches the flag and the pinned test line together, and back again", () => {
    const root = sandbox();
    made.push(root);
    const live = currentVariant(root)!;

    const r = run("glasses", "--root", root);
    expect(r.status).toBe(0);
    expect(currentVariant(root)).toBe("glasses");
    expect(readFileSync(path.join(root, "tests/unit/components/brand-name.test.tsx"), "utf8")).toContain('const LIVE_LOGO = "glasses"');
    expect(r.stdout).toContain("navbar-logo-height");

    expect(run(live, "--root", root).status).toBe(0);
    expect(currentVariant(root)).toBe(live);
  });

  it("knows the three switchable logos of the owner's passphrases", () => {
    const root = sandbox();
    made.push(root);
    for (const v of ["glasses", "wordmark-blue", "wordmark-blue-symbol"]) {
      const r = run(v, "--root", root);
      expect(r.status).toBe(0);
      expect(currentVariant(root)).toBe(v);
    }
  });

  it("does nothing when the variant is already set", () => {
    const root = sandbox();
    made.push(root);
    const live = currentVariant(root)!;
    const r = run(live, "--root", root);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Bez zmian");
  });

  it("refuses unknown names and variants whose files are missing, without touching anything", () => {
    const root = sandbox();
    made.push(root);
    const live = currentVariant(root);

    const bad = run("okularki", "--root", root);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("nieznany wariant");

    rmSync(path.join(root, "public/logo-glasses.svg"));
    const missing = run("glasses", "--root", root);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("public/logo-glasses.svg");
    expect(currentVariant(root)).toBe(live);
  });

  it("refuses a name that is not in the BrandLogoVariant type (no type errors after a switch)", () => {
    const root = sandbox();
    made.push(root);
    const flags = path.join(root, "lib/ui-flags.ts");
    writeFileSync(flags, readFileSync(flags, "utf8").replace(/\| "wordmark" /, ""));

    expect(run("wordmark", "--root", root).status).toBe(1);
  });
});
