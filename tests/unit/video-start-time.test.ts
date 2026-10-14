import { describe, expect, it } from "vitest";
import {
  MAX_START_SECONDS,
  clampStartTime,
  formatClock,
  parseStartTime,
  withStartTime,
} from "@/lib/video-start-time";

describe("parseStartTime (?t=)", () => {
  it("reads whole seconds", () => {
    expect(parseStartTime("90")).toBe(90);
    expect(parseStartTime("0")).toBe(0);
    expect(parseStartTime(" 15 ")).toBe(15);
  });

  it("cuts fractions instead of rejecting them", () => {
    expect(parseStartTime("90.9")).toBe(90);
  });

  it("reads the unit form", () => {
    expect(parseStartTime("1m30s")).toBe(90);
    expect(parseStartTime("45s")).toBe(45);
    expect(parseStartTime("2m")).toBe(120);
    expect(parseStartTime("1h2m3s")).toBe(3723);
    expect(parseStartTime("1M30S")).toBe(90);
  });

  it("reads the clock form", () => {
    expect(parseStartTime("1:30")).toBe(90);
    expect(parseStartTime("1:02:03")).toBe(3723);
  });

  it("rejects garbage, negatives and values beyond 24 hours", () => {
    for (const bad of ["", "abc", "-5", "1m30", "1e3", "NaN", "1:99", "m", "10s20", "9".repeat(20)]) {
      expect(parseStartTime(bad)).toBeNull();
    }
    expect(parseStartTime(null)).toBeNull();
    expect(parseStartTime(undefined)).toBeNull();
    expect(parseStartTime(String(MAX_START_SECONDS + 1))).toBeNull();
    expect(parseStartTime(String(MAX_START_SECONDS))).toBe(MAX_START_SECONDS);
  });
});

describe("clampStartTime", () => {
  it("keeps a value inside the video and lands one second before the end", () => {
    expect(clampStartTime(30, 600)).toBe(30);
    expect(clampStartTime(600, 600)).toBe(599);
    expect(clampStartTime(9999, 600)).toBe(599);
  });

  it("leaves the value alone when the length is unknown", () => {
    expect(clampStartTime(120, null)).toBe(120);
    expect(clampStartTime(120, Number.NaN)).toBe(120);
    expect(clampStartTime(120, 0)).toBe(120);
  });

  it("never goes negative", () => {
    expect(clampStartTime(-4, 100)).toBe(0);
    expect(clampStartTime(Number.NaN, 100)).toBe(0);
  });
});

describe("formatClock and withStartTime", () => {
  it("formats m:ss and h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3723)).toBe("1:02:03");
  });

  it("sets and removes t on a link, keeping the rest", () => {
    expect(withStartTime("https://example.com/?v=film", 90)).toBe("https://example.com/?v=film&t=90");
    expect(withStartTime("https://example.com/?v=film&t=5", 90)).toBe("https://example.com/?v=film&t=90");
    expect(withStartTime("https://example.com/?v=film&t=5", null)).toBe("https://example.com/?v=film");
    expect(withStartTime("https://example.com/?v=film", 0)).toBe("https://example.com/?v=film");
  });

  it("returns a value that is not a URL unchanged", () => {
    expect(withStartTime("", 90)).toBe("");
  });
});
