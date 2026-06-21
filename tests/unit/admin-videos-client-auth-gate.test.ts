import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("admin videos client auth/loading regression", () => {
  const pageSource = () => read("app/admin/videos/page.tsx");
  const hookSource = () => read("app/admin/videos/components/useAdminVideos.ts");

  it("does not depend on /api/admin/stats for the videos page authorization gate", () => {
    expect(pageSource()).not.toContain('/api/admin/stats');
  });

  it("loads admin videos directly from /api/admin/videos", () => {
    expect(hookSource()).toContain('fetch(url, { cache: "no-store" })');
    expect(hookSource()).toContain('`/api/admin/videos?page=${p}');
  });

  it("maps 401/403 from the admin videos API to the permission message", () => {
    const source = hookSource();

    expect(source).toContain('res.status === 401 || res.status === 403');
    expect(source).toContain('setError("Brak uprawnień administratora.")');
  });

  it("maps server and network failures to video-loading errors instead of permission errors", () => {
    const source = hookSource();

    expect(source).toContain('Nie udało się pobrać listy filmów z powodu błędu serwera.');
    expect(source).toContain('Nie udało się pobrać listy filmów z powodu błędu połączenia z serwerem.');
    expect(source).not.toContain('Wystąpił błąd podczas weryfikacji uprawnień.');
  });
});

describe("admin client pages avoid unrelated auth gates", () => {
  it("does not use /api/admin/stats as an auth gate outside the dashboard page", () => {
    const collectFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath);
      return entry.isFile() && /\.(tsx|ts)$/.test(entry.name) ? [entryPath] : [];
    });

    const adminFiles = collectFiles(path.join(process.cwd(), "app/admin"));

    const offenders = adminFiles
      .filter((file) => !file.endsWith(path.join("app/admin/page.tsx")))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return source.includes('/api/admin/stats') && source.includes('Brak uprawnień administratora');
      })
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
