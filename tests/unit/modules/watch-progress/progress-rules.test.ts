import { describe, expect, it } from "vitest";
import {
  PROGRESS_MIN_SECONDS,
  decideProgressWrite,
  isResumablePosition,
  parseDurationText,
} from "@/lib/modules/watch-progress/domain/progress-rules";

describe("decideProgressWrite", () => {
  it("ignores positions under 5 seconds", () => {
    expect(decideProgressWrite({ positionSeconds: 0, durationSeconds: 600 })).toEqual({ action: "ignore" });
    expect(decideProgressWrite({ positionSeconds: 4.9, durationSeconds: 600 })).toEqual({ action: "ignore" });
  });

  it("saves from exactly 5 seconds", () => {
    expect(PROGRESS_MIN_SECONDS).toBe(5);
    expect(decideProgressWrite({ positionSeconds: 5, durationSeconds: 600 })).toEqual({
      action: "save",
      positionSeconds: 5,
      durationSeconds: 600,
    });
  });

  it("saves in the middle and keeps whole seconds", () => {
    expect(decideProgressWrite({ positionSeconds: 300.7, durationSeconds: 600 })).toEqual({
      action: "save",
      positionSeconds: 300,
      durationSeconds: 600,
    });
  });

  it("clears at 95 % and above, saves just below", () => {
    // 95 % of 600 s is 570 s.
    expect(decideProgressWrite({ positionSeconds: 569, durationSeconds: 600 })).toMatchObject({ action: "save" });
    expect(decideProgressWrite({ positionSeconds: 570, durationSeconds: 600 })).toEqual({ action: "clear" });
    expect(decideProgressWrite({ positionSeconds: 600, durationSeconds: 600 })).toEqual({ action: "clear" });
    expect(decideProgressWrite({ positionSeconds: 900, durationSeconds: 600 })).toEqual({ action: "clear" });
  });

  it("saves without a duration (95 % cannot be told) but still honours the 5 s bound", () => {
    expect(decideProgressWrite({ positionSeconds: 200 })).toEqual({
      action: "save",
      positionSeconds: 200,
      durationSeconds: null,
    });
    expect(decideProgressWrite({ positionSeconds: 3, durationSeconds: null })).toEqual({ action: "ignore" });
  });

  it("ignores values that are not numbers", () => {
    expect(decideProgressWrite({ positionSeconds: Number.NaN })).toEqual({ action: "ignore" });
    expect(decideProgressWrite({ positionSeconds: -10, durationSeconds: 600 })).toEqual({ action: "ignore" });
  });
});

describe("isResumablePosition", () => {
  it("is true between 5 s and 95 %", () => {
    expect(isResumablePosition(5, 600)).toBe(true);
    expect(isResumablePosition(569, 600)).toBe(true);
    expect(isResumablePosition(4, 600)).toBe(false);
    expect(isResumablePosition(570, 600)).toBe(false);
  });

  it("only the lower bound applies without a duration", () => {
    expect(isResumablePosition(100, null)).toBe(true);
    expect(isResumablePosition(2, undefined)).toBe(false);
  });
});

describe("parseDurationText", () => {
  it("reads M:SS and H:MM:SS", () => {
    expect(parseDurationText("12:45")).toBe(765);
    expect(parseDurationText("1:02:03")).toBe(3723);
  });

  it("returns null for anything else", () => {
    expect(parseDurationText(null)).toBeNull();
    expect(parseDurationText("")).toBeNull();
    expect(parseDurationText("abc")).toBeNull();
    expect(parseDurationText("0:00")).toBeNull();
  });
});
