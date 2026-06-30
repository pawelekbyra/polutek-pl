import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const approvedPublicDesignRoutes = [
  "app/katalog/page.tsx",
  "app/katalog2/page.tsx",
  "app/katalog3/page.tsx",
];

const approvedRouteSubstrings = new Set([
  "original-" + "upload",
  "/" + "upload",
  "mux-" + "upload",
  "cover-" + "upload",
  "image-" + "upload",
]);

const blockedRouteWords = [
  "camp" + "aign",
  "crowd" + "funding",
  "fund" + "raising",
  "market" + "place",
  "on" + "boarding",
  "upload",
  "trans" + "cod",
];

function collectRouteFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) return collectRouteFiles(fullPath, root);
    if (entry !== "page.tsx" && entry !== "route.ts") return [];

    return relative(process.cwd(), fullPath);
  });
}

describe("private beta route surface", () => {
  it("keeps approved public design routes available", () => {
    const routes = collectRouteFiles(join(process.cwd(), "app")).sort();

    expect(routes).toEqual(expect.arrayContaining(approvedPublicDesignRoutes));
  });

  it("does not expose blocked route families outside approved implementation endpoints", () => {
    const routes = collectRouteFiles(join(process.cwd(), "app")).sort();
    const outOfScopeRoutes = routes.filter((route) => {
      const isApprovedImplementationRoute = Array.from(approvedRouteSubstrings).some((part) => route.includes(part));
      return !isApprovedImplementationRoute && blockedRouteWords.some((word) => route.toLowerCase().includes(word));
    });

    expect(outOfScopeRoutes).toEqual([]);
  });
});
