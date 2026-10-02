import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Every mutating handler (POST/PUT/PATCH/DELETE) under app/api/admin must reach
 * a recordAuditEvent(...) call, either directly or through the use case /
 * service it calls, unless it is on the explicit allowlist below.
 *
 * "Reaches" is a static over-approximation: starting at the route file we follow
 * every identifier that resolves to an exported function/class/const somewhere in
 * lib/ (depth-limited) and look for a recordAuditEvent(Safe) call. It catches the
 * real failure mode (a new admin mutation that never touches the audit log) but
 * is not a proof that every branch is audited.
 */

const ROOT = process.cwd();
const ADMIN_API = "app/api/admin";
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;
const MAX_DEPTH = 5;

/** Mutating admin handlers that intentionally do not write an audit event. */
const ALLOWLIST: Record<string, string> = {
  "app/api/admin/health/cloudflare/route.ts": "POST is a diagnostic direct-upload probe: it checks provider credentials and changes no application state.",
  "app/api/admin/health/mux/route.ts": "POST is a diagnostic direct-upload probe: it checks provider credentials and changes no application state.",
  "app/api/admin/videos/[id]/original-upload/multipart/parts/route.ts": "POST only signs short-lived part URLs of an already audited upload session (start/complete/abort are audited); it changes no state and is called hundreds of times per file.",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(rel, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

// exported identifier -> files defining it (lib/ only)
const definitions = new Map<string, string[]>();
for (const file of walk("lib")) {
  const source = read(file);
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const)\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const list = definitions.get(match[1]) ?? [];
    list.push(file);
    definitions.set(match[1], list);
  }
}

const AUDIT_CALL = /\brecordAuditEvent(?:Safe)?\s*\(/;
const isAuditModule = (file: string) => file.startsWith("lib/modules/audit/");

function reachesAudit(file: string, seen = new Set<string>(), depth = 0): boolean {
  if (seen.has(file) || depth > MAX_DEPTH || isAuditModule(file)) return false;
  seen.add(file);
  const source = read(file);
  if (AUDIT_CALL.test(source)) return true;

  const identifiers = new Set(source.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? []);
  for (const id of identifiers) {
    for (const defFile of definitions.get(id) ?? []) {
      if (defFile !== file && reachesAudit(defFile, seen, depth + 1)) return true;
    }
  }
  return false;
}

function mutatingMethods(source: string): string[] {
  return MUTATING.filter((method) =>
    new RegExp(`export\\s+(?:async\\s+function|const|function)\\s+${method}\\b`).test(source),
  );
}

const routes = walk(ADMIN_API).filter((file) => file.endsWith("/route.ts"));
const mutatingRoutes = routes.filter((file) => mutatingMethods(read(file)).length > 0);

describe("admin mutations are audited", () => {
  it("finds the admin routes", () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(mutatingRoutes.length).toBeGreaterThan(20);
  });

  it.each(mutatingRoutes)("%s reaches recordAuditEvent (or is allowlisted)", (file) => {
    if (ALLOWLIST[file]) return;
    expect(
      reachesAudit(file),
      `${file} has a ${mutatingMethods(read(file)).join("/")} handler with no recordAuditEvent in its call chain. ` +
        `Record an audit event, or add the route to ALLOWLIST with a written reason.`,
    ).toBe(true);
  });

  it("keeps the allowlist honest: every entry exists, is mutating, and has a reason", () => {
    for (const [file, reason] of Object.entries(ALLOWLIST)) {
      expect(reason.length, `${file} needs a reason`).toBeGreaterThan(10);
      expect(mutatingRoutes, `${file} is allowlisted but is not a mutating admin route`).toContain(file);
    }
  });

  it("does not write auditLog rows directly from routes (use recordAuditEvent)", () => {
    for (const file of routes) {
      expect(read(file), `${file} writes prisma.auditLog directly`).not.toMatch(/auditLog\.create/);
    }
  });
});
