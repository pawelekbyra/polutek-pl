import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

import { SEARCH_LIMIT, SEARCH_WINDOW_MS, takeSearchBudget } from "@/lib/search-rate-limit";

beforeEach(() => m.rateLimit.mockReset());

describe("shared search budget (W01)", () => {
  it("counts per client address only, with no locale or path in the key", async () => {
    m.rateLimit.mockResolvedValue({ success: true, remaining: 5 });
    expect(await takeSearchBudget("1.2.3.4")).toEqual({ success: true });
    expect(m.rateLimit).toHaveBeenCalledWith({ key: "search:1.2.3.4", limit: SEARCH_LIMIT, windowMs: SEARCH_WINDOW_MS });
  });

  it("reports an exhausted budget", async () => {
    m.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    expect(await takeSearchBudget("1.2.3.4")).toEqual({ success: false });
  });

  it("is the gate of both the API route and the search page, before any query runs", () => {
    const route = readFileSync("app/api/search/route.ts", "utf8");
    const page = readFileSync("app/[locale]/search/page.tsx", "utf8");
    expect(route).toContain("takeSearchBudget(");
    expect(page).toContain("takeSearchBudget(");
    expect(page.indexOf("takeSearchBudget(")).toBeLessThan(page.indexOf("searchPublicVideos(params"));
  });
});
