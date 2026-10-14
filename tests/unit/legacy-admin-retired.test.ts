import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract of phase 5 (docs/architecture/admin-phase5.md): the public site (www) carries no admin code.
 * The old /admin pages and /api/admin routes are gone; middleware.ts answers them with a 308 / 404
 * (tests/unit/auth/middleware-gating.test.ts, tests/unit/admin-legacy-redirects.test.ts).
 */
const root = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "coverage", "public", "tests", "docs"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const wwwSources = ["app", "lib", "scripts", "middleware.ts", "next.config.mjs"].flatMap((entry) => {
  const full = join(root, entry);
  if (!existsSync(full)) return [];
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => relative(root, file);

describe("old admin is retired from the public site", () => {
  it("has no app/admin pages and no app/api/admin routes", () => {
    expect(existsSync(join(root, "app/admin"))).toBe(false);
    expect(existsSync(join(root, "app/api/admin"))).toBe(false);
    expect(existsSync(join(root, "components/skeletons/admin.tsx"))).toBe(false);
  });

  it("has no route.ts under any path segment named admin", () => {
    const offenders = wwwSources.filter((file) => /(^|\/)app\/(?:.*\/)?admin\//.test(rel(file)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("imports nothing from the removed admin modules", () => {
    const removed = [
      /@\/app\/admin/,
      /components\/skeletons\/admin/,
      /@\/lib\/auth-utils/,
      /@\/lib\/api\/admin-(?:body|rate-limit|recent-sign-in|payments-query|users-export-query)/,
      /@\/lib\/api\/app-context-factory/,
      /@\/lib\/admin\//,
      /@\/lib\/blob-config/,
      /@\/lib\/modules\/admin-stats/,
    ];
    const offenders = wwwSources.flatMap((file) => removed.filter((re) => re.test(read(file))).map((re) => `${rel(file)} -> ${re}`));
    expect(offenders).toEqual([]);
  });

  it("never calls the removed /api/admin from the public bundle or the server code", () => {
    const allowed = new Set(["lib/admin-legacy-redirects.ts", "middleware.ts"]);
    const offenders = wwwSources.filter((file) => !allowed.has(rel(file)) && /\/api\/admin(?![-\w])/.test(read(file)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("keeps no admin controls in the public comment UI (moderation lives in the panel, decision 8)", () => {
    const item = read(join(root, "app/components/comments/components/CommentItem.tsx"));
    expect(item).not.toMatch(/\/api\/admin/);
    expect(item).not.toMatch(/handleHide|handleRestore|handleToggleHeart/);
    // Ordinary user features stay.
    for (const feature of ["onReport", "onDelete", "onReply", "onLike"]) expect(item).toContain(feature);
  });

  it("links the owner's menu to the panel in a new tab with rel=noopener", () => {
    for (const file of ["app/components/auth/UserMenu.tsx", "app/components/auth/AccountModal.tsx"]) {
      const source = read(join(root, file));
      expect(source).toContain("ADMIN_PANEL_ORIGIN");
      expect(source).toContain('rel="noopener noreferrer"');
      expect(source).not.toMatch(/href="\/admin"/);
    }
  });

  it("has no ADMIN_EMAILS bootstrap in code, CI or the env template", () => {
    const files = [
      ...wwwSources,
      join(root, ".env.example"),
      join(root, ".github/workflows/ci.yml"),
    ];
    const offenders = files
      .filter((file) => rel(file) !== "scripts/check-strict-escapes.ts")
      .filter((file) => {
        // Comments that say the variable is gone are fine; any other use is not. (The historical audit action
        // name AUTH_ADMIN_BOOTSTRAP stays in the briefing queries: old AuditLog rows carry it.)
        const code = read(file).split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*|#)/.test(line)).join("\n");
        return /ADMIN_EMAILS|isAdminEmail|getAdminEmails/.test(code);
      });
    expect(offenders.map(rel)).toEqual([]);
  });
});
