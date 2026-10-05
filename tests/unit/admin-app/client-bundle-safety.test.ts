import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `npm run admin:build` fails when a client component (browser bundle) reaches server-only code such as the
 * Postgres driver. `quality` does not run the build, so this guards the two known ways it happens:
 *  - importing components/ui.tsx (it needs runtime helpers from the admin-overview barrel, which re-exports DB code);
 *  - importing a module barrel with runtime (non-type) imports from a "use client" file.
 * Client components should import @admin/components/badge, icons, or props-only helpers.
 */
const ROOT = join(__dirname, "../../../apps/admin");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n === ".next") return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("client components stay out of server-only code", () => {
  const clients = files(ROOT).filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8").slice(0, 400)));

  it("finds client components", () => expect(clients.length).toBeGreaterThan(5));

  it.each(clients.map((f) => [f.replace(ROOT + "/", ""), f]))("%s has no server-only imports", (_name, f) => {
    const src = readFileSync(f as string, "utf8");
    expect(src).not.toMatch(/from ["']@admin\/components\/ui["']/);
    expect(src).not.toMatch(/from ["']\.\.?\/(\.\.\/)*ui["']/);
    const runtimeModuleImports = [...src.matchAll(/^import (?!type)[^\n]*from ["']@\/lib\/modules\/[a-z-]+["']/gm)].map((m) => m[0]);
    expect(runtimeModuleImports, "client components must not import runtime code from a module barrel").toEqual([]);
    expect(src).not.toMatch(/from ["'](postgres|pg|@prisma\/client)["']/);
  });
});
