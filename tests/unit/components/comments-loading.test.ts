import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Comments loading state verification", () => {
  it("renders one readable comments loading state", () => {
    const source = component("app/components/comments/EmbeddedComments.tsx");
    expect(source).toContain("{isLoading ? (");
    expect(source).toContain("<CommentsLoadingState language={language} />");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Warming up the discussion");
    expect(source).toContain("motion-reduce:animate-none");
    expect(source).toContain("<h3 className=\"font-brand text-[15px] font-bold text-[var(--chan-ink)] truncate\"");
  });

  it("displays loading text in load more button", () => {
    const source = component("app/components/comments/EmbeddedComments.tsx");
    expect(source).toContain("{isFetchingNextPage ? (");
    expect(source).toContain('language === "pl" ? "Ładowanie..." : "Loading..."');
  });
});
