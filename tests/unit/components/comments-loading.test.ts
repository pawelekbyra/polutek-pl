import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Comments loading state verification", () => {
  it("renders skeleton for header while loading", () => {
    const source = component("app/components/comments/EmbeddedComments.tsx");
    expect(source).toContain("{isLoading ? (");
    expect(source).toContain("<Skeleton className=\"h-7 w-48\" />");
    // Updated to a non-italic, uppercase heading style
    expect(source).toContain("<h3 className=\"font-sans text-[14px] sm:text-[15px] font-black uppercase not-italic tracking-wide text-[#0f0f0f] truncate\"");
  });

  it("displays loading text in load more button", () => {
    const source = component("app/components/comments/EmbeddedComments.tsx");
    expect(source).toContain("{isFetchingNextPage ? (");
    expect(source).toContain('language === "pl" ? "Ładowanie..." : "Loading..."');
  });
});
