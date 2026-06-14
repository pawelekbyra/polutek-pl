import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("admin route authorization entry points", () => {
  const repairedAdminRoutes = [
    "app/api/admin/channel/route.ts",
    "app/api/admin/maintenance/main-channel/preview/route.ts",
    "app/api/admin/maintenance/main-channel/apply/route.ts",
    "app/api/admin/comments/[commentId]/hide/route.ts",
    "app/api/admin/comments/[commentId]/restore/route.ts",
    "app/api/admin/comments/[commentId]/delete/route.ts",
    "app/api/admin/comments/[commentId]/heart/route.ts",
    "app/api/admin/comments/reports/route.ts",
    "app/api/admin/comments/reports/[reportId]/resolve/route.ts",
    "app/api/admin/videos/route.ts",
    "app/api/admin/videos/[id]/route.ts",
    "app/api/admin/videos/[id]/actions/route.ts",
    "app/api/admin/videos/resync/route.ts",
    "app/api/admin/videos/reorder/route.ts",
    "app/api/admin/users/export/route.ts",
  ];

  it.each(repairedAdminRoutes)(
    "%s does not re-run getActorFromAuth after requireAdminForApi",
    (file) => {
      const source = read(file);

      expect(source).not.toContain("getActorFromAuth");
      if (source.includes("requireAdminForApi")) {
        expect(source).toContain("adminUserId");
      }
    },
  );

  it("server auth resolver contains no claim-based admin grant", () => {
    const source = read("lib/api/auth.ts");

    expect(source).not.toMatch(/role\s*===\s*['"]admin['"]/);
    expect(source).not.toMatch(/role\s*===\s*['"]org:admin['"]/);
    expect(source).not.toMatch(
      /sessionClaims\?\.publicMetadata|sessionClaims\?\.metadata.*role\s*===/,
    );
  });
});
