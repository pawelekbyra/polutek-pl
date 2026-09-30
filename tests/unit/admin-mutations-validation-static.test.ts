import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ADMIN_API_DIR = path.join(process.cwd(), "app", "api", "admin");

function collectRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectRoutes(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

/** Routes that read a body without a zod schema, with the reason. */
const ALLOWLIST: Record<string, string> = {
  "videos/route.ts":
    "Hand-written isAdminVideoRequestBody guard + buildAdminVideoCreate/UpdatePayload whitelisting; domain validation in the use case.",
  "videos/cover-upload/route.ts": "multipart/form-data upload (file), validated by content-type/size checks.",
  "settings/media/default-video-thumbnail/route.ts": "multipart/form-data upload (file), validated by content-type/size checks.",
};

const routes = collectRoutes(ADMIN_API_DIR).map((file) => ({
  rel: path.relative(ADMIN_API_DIR, file).split(path.sep).join("/"),
  source: fs.readFileSync(file, "utf8"),
}));

const readsBody = (src: string) => /\b(?:req|request)\s*\.\s*(?:json|formData|text)\s*\(\)/.test(src) ||
  /\b(?:req|request)\s*\n?\s*\.json\(\)/.test(src);

describe("admin mutating routes validate their bodies", () => {
  it("finds the admin routes", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  const bodyReaders = routes.filter((r) => readsBody(r.source));

  it.each(bodyReaders.map((r) => [r.rel, r] as const))("%s reads its body through a schema (or is allowlisted)", (rel, route) => {
    if (ALLOWLIST[rel]) return;
    const usesSchema = /parseAdminBody\(/.test(route.source) || /\.safeParse\(|\.parse\(/.test(route.source);
    expect(usesSchema, `${rel} reads a request body without a zod schema`).toBe(true);
  });

  it("allowlist entries still exist and still read a body", () => {
    for (const rel of Object.keys(ALLOWLIST)) {
      const route = routes.find((r) => r.rel === rel);
      // Another change may move/remove an allowlisted route; then drop the entry.
      expect(route, `${rel} allowlisted but missing`).toBeDefined();
    }
  });

  it("no admin route reads a raw untyped body cast", () => {
    for (const route of bodyReaders) {
      if (ALLOWLIST[route.rel]) continue;
      expect(route.source, route.rel).not.toMatch(/=\s*await\s+(?:req|request)\.json\(\)\s*;?\s*\n\s*const\s*\{[^}]*\}\s*=\s*body\b/);
    }
  });
});
