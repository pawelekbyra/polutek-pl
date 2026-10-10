/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ZoomLock } from "@/app/components/ZoomLock";

function touch(type: string, touches: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: Array.from({ length: touches }, () => ({})) });
  return event;
}

describe("ZoomLock", () => {
  afterEach(cleanup);

  it("blocks the iOS pinch gestures and a two-finger touchmove", () => {
    render(<ZoomLock />);
    expect(document.dispatchEvent(new Event("gesturestart", { cancelable: true }))).toBe(false);
    expect(document.dispatchEvent(new Event("gesturechange", { cancelable: true }))).toBe(false);
    expect(document.dispatchEvent(touch("touchmove", 2))).toBe(false);
  });

  it("leaves one-finger scrolling and a single tap alone, and blocks only the quick second tap", () => {
    render(<ZoomLock />);
    expect(document.dispatchEvent(touch("touchmove", 1))).toBe(true);
    expect(document.dispatchEvent(touch("touchstart", 1))).toBe(true);
    expect(document.dispatchEvent(touch("touchstart", 1))).toBe(false);
  });

  it("stops blocking once unmounted", () => {
    const view = render(<ZoomLock />);
    view.unmount();
    expect(document.dispatchEvent(new Event("gesturestart", { cancelable: true }))).toBe(true);
  });
});
