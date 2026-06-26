import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const adminSourceFiles = (dir = join(process.cwd(), "app/admin")): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) return adminSourceFiles(fullPath);
    if (/\.(ts|tsx)$/.test(entry)) return [fullPath];
    return [];
  });

const maintainedAdminPages = [
  "app/admin/comments/page.tsx",
  "app/admin/comments/reports/page.tsx",
  "app/admin/emails/page.tsx",
  "app/admin/channel/ChannelSettingsForm.tsx",
  "app/admin/payments/PaymentSettingsForm.tsx",
  "app/admin/users/page.tsx",
  "app/admin/users/dashboard/page.tsx",
  "app/admin/users/payments/page.tsx",
  "app/admin/users/[userId]/page.tsx",
  "app/admin/videos/components/AdminVideoHeader.tsx",
  "app/admin/videos/[id]/page.tsx",
  "app/admin/videos/layout/page.tsx",
];

describe("admin navigation UX", () => {
  it("provides a shared accessible Polish admin navigation primitive", () => {
    const source = read("app/admin/components/AdminNavigation.tsx");

    expect(source).toContain("export function AdminNavigation");
    expect(source).toContain("aria-label={ariaLabel}");
    expect(source).toContain('aria-current="page"');
    expect(source).toContain('ariaLabel = "Nawigacja administracyjna"');
    expect(source).toContain("backLabel");
  });

  it("uses the shared primitive on maintained admin sections that need a parent route", () => {
    for (const file of maintainedAdminPages) {
      expect(read(file), file).toContain("AdminNavigation");
    }
  });

  it("keeps maintained admin pages connected to /admin or a parent admin section", () => {
    const expectedBackRoutes: Record<string, string> = {
      "app/admin/comments/page.tsx": 'backHref="/admin"',
      "app/admin/comments/reports/page.tsx": 'backHref="/admin/comments"',
      "app/admin/emails/page.tsx": 'backHref="/admin"',
      "app/admin/channel/ChannelSettingsForm.tsx": 'backHref="/admin"',
      "app/admin/payments/PaymentSettingsForm.tsx": 'backHref="/admin"',
      "app/admin/users/page.tsx": 'backHref="/admin"',
      "app/admin/users/dashboard/page.tsx": 'backHref="/admin/users"',
      "app/admin/users/payments/page.tsx": 'backHref="/admin/users"',
      "app/admin/users/[userId]/page.tsx": 'backHref="/admin/users"',
      "app/admin/videos/components/AdminVideoHeader.tsx": 'backHref="/admin"',
      "app/admin/videos/[id]/page.tsx": 'backHref="/admin/videos"',
      "app/admin/videos/layout/page.tsx": 'backHref="/admin/videos"',
    };

    for (const [file, expectedRoute] of Object.entries(expectedBackRoutes)) {
      expect(read(file), file).toContain(expectedRoute);
    }
  });

  it("does not leave native confirm calls in app/admin", () => {
    const combinedSource = adminSourceFiles()
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/\bconfirm\s*\(/);
  });

  it("keeps video reorder UX honest about explicit up/down controls", () => {
    const source = read("app/admin/videos/layout/page.tsx");

    expect(source).toContain("Zmieniaj kolejność filmów strzałkami");
    expect(source).toContain("ArrowUp");
    expect(source).toContain("ArrowDown");
    expect(source).toContain("Przesuń film wyżej");
    expect(source).toContain("Przesuń film niżej");
    expect(source).not.toMatch(/drag|drop|przeciąg/i);
  });
});
