import { describe, expect, it } from "vitest";
import {
  getViewThresholdMs,
  shouldSendViewForPlaybackPosition,
} from "@/app/components/video-view-threshold";

describe("video player view threshold helpers", () => {
  it("keeps the view-count threshold at the existing ten second boundary", () => {
    expect(getViewThresholdMs()).toBe(10_000);
  });

  it("does not send the watched event before the threshold", () => {
    expect(shouldSendViewForPlaybackPosition(9_999)).toBe(false);
  });

  it("sends the watched event at and after the threshold", () => {
    expect(shouldSendViewForPlaybackPosition(10_000)).toBe(true);
    expect(shouldSendViewForPlaybackPosition(12_000)).toBe(true);
  });
});
