import { describe, expect, it } from "vitest";
import { formatDelta, formatPercent, formatWatchTime, niceMax, sortRows } from "@/app/components/studio/analytics/analytics-format";

describe("studio analytics formatting", () => {
  it("formats watch time from seconds to hours", () => {
    expect(formatWatchTime(0)).toBe("0 s");
    expect(formatWatchTime(59)).toBe("59 s");
    expect(formatWatchTime(60)).toBe("1 min");
    expect(formatWatchTime(3600)).toBe("1 h");
    expect(formatWatchTime(3600 + 5 * 60)).toBe("1 h 05 min");
    expect(formatWatchTime(-4)).toBe("0 s");
  });

  it("formats percent and signed deltas; a withheld value stays null", () => {
    expect(formatPercent(null, "en")).toBeNull();
    expect(formatPercent(41.26, "en")).toBe("41.3%");
    expect(formatDelta(12, "en")).toBe("+12");
    expect(formatDelta(-3, "en")).toBe("-3");
    expect(formatDelta(0, "en")).toBe("0");
  });

  it("picks a nice axis maximum above the data and never zero", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(120)).toBe(200);
    expect(niceMax(4000)).toBe(5000);
  });

  it("sorts without mutating and keeps withheld averages last in both directions", () => {
    const rows = [
      { title: "b", views: 5, watchSeconds: 1, avgPctViewed: null as number | null, comments: 0, likes: 0 },
      { title: "a", views: 9, watchSeconds: 1, avgPctViewed: 30 as number | null, comments: 0, likes: 0 },
      { title: "c", views: 1, watchSeconds: 1, avgPctViewed: 60 as number | null, comments: 0, likes: 0 },
    ];
    const copy = [...rows];
    expect(sortRows(rows, "views", "desc").map((r) => r.title)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, "title", "asc").map((r) => r.title)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, "avgPctViewed", "desc").map((r) => r.title)).toEqual(["c", "a", "b"]);
    expect(sortRows(rows, "avgPctViewed", "asc").map((r) => r.title)).toEqual(["a", "c", "b"]);
    expect(rows).toEqual(copy);
  });
});
