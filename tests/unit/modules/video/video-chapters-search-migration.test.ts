import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("prisma/migrations/20261020130000_video_chapters_search/migration.sql");
const original = read("prisma/migrations/20261019170000_video_search/migration.sql");
const page = read("app/[locale]/(home)/page.tsx");

// Behaviour on a real database was checked by running the three migrations in PGlite (see the PR); these checks keep
// the file's contract: what feeds searchText, when the trigger fires, and what must not change.
describe("migration 20261020130000_video_chapters_search", () => {
  it("adds chapter titles (PL and EN) to searchText for PUBLIC videos only, and only from a JSON array", () => {
    expect(migration).toContain(`NEW."tier" = 'PUBLIC' AND NEW."chapters" IS NOT NULL AND jsonb_typeof(NEW."chapters") = 'array'`);
    expect(migration).toContain(`c->>'title'`);
    expect(migration).toContain(`c->>'titleEn'`);
    expect(migration).toContain("left(chapter_text, 2000)");
  });
  it("fires the trigger when chapters change, with the same columns as before otherwise", () => {
    const columns = (sql: string) => /UPDATE OF ([^\n]+)\nON "Video"/.exec(sql)?.[1].split(",").map((c) => c.trim()) ?? [];
    expect(columns(original).length).toBeGreaterThan(5);
    expect(columns(migration)).toEqual([...columns(original), '"chapters"']);
  });
  it("keeps the description rule and the duration parsing of the original function", () => {
    expect(migration).toContain(`CASE WHEN NEW."tier" = 'PUBLIC' THEN left(concat_ws(' ', NEW."description", NEW."descriptionEn"), 3000) END`);
    for (const line of [`NEW."duration" ~ '^[0-9]{1,3}(:[0-9]{1,2}){1,2}$'`, `parts[1]::int * 3600 + parts[2]::int * 60 + parts[3]::int`]) {
      expect(original).toContain(line);
      expect(migration).toContain(line);
    }
  });
  it("does not redefine the normalization (the TS mirror stays valid), changes no table and backfills", () => {
    expect(migration).not.toContain("video_search_normalize(input");
    expect(migration).not.toContain("translate(");
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|FUNCTION)|ALTER TABLE/i);
    expect(migration).toContain(`UPDATE "Video" SET "title" = "title";`);
    expect(migration).not.toContain("\r");
  });
});

describe("home page structured data", () => {
  it("adds hasPart only from the chapter clips of an indexable video", () => {
    expect(page).toContain("getPublicChapterClips");
    expect(page).toContain("...(chapterClips ? { hasPart: chapterClips } : {})");
    expect(page).toMatch(/chapterClips = selectedVideo && indexable \?/);
  });
});
