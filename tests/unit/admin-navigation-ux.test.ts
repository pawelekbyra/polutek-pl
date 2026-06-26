import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const source = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const maintainedAdminScreens = [
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
  it("provides one shared accessible admin navigation primitive", () => {
    const navigation = source("app/admin/components/AdminNavigation.tsx");

    expect(navigation).toContain("export function AdminNavigation");
    expect(navigation).toContain('aria-label="Nawigacja administracyjna"');
    expect(navigation).toContain('aria-label="Ścieżka administracyjna"');
    expect(navigation).toContain('aria-current="page"');
    expect(navigation).toContain("backLabel");
    expect(navigation).toContain("Panel admina");
  });

  it("uses shared admin navigation on maintained admin screens", () => {
    for (const path of maintainedAdminScreens) {
      expect(source(path), path).toContain("AdminNavigation");
    }
  });

  it("keeps native confirm dialogs out of app/admin", async () => {
    const { readdir } = await import("node:fs/promises");
    const files: string[] = [];

    async function collect(dir: string) {
      for (const entry of await readdir(join(repoRoot, dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await collect(path);
        if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) files.push(path);
      }
    }

    await collect("app/admin");

    for (const file of files) {
      expect(source(file), file).not.toContain("confirm(");
    }
  });

  it("keeps video layout reorder as explicit up/down controls instead of fake drag-and-drop", () => {
    const layout = source("app/admin/videos/layout/page.tsx");

    expect(layout).toContain("moveItem(index, 'up')");
    expect(layout).toContain("moveItem(index, 'down')");
    expect(layout).toContain("Przesuń film wyżej");
    expect(layout).toContain("Przesuń film niżej");
    expect(layout).not.toMatch(/drag|drop|przeciąg/i);
  });
});
