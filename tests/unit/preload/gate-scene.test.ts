/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { captureButton } from "@/app/components/preload/gate-scene";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ENTER button captured for the warp scene", () => {
  it("takes the key's settled colours from the palette, not a colour caught mid-transition", () => {
    // In the browser the palette variables are inherited from the gate screen; jsdom does not inherit
    // custom properties, so they sit on the button here.
    document.body.innerHTML = '<button style="--mx-ink:#111827;--mx-bg:#f7f9fc;background:#f7f9fc;color:#111827;border:1px solid #111827">ENTER</button>';
    const button = document.querySelector("button")!;
    button.getBoundingClientRect = () => ({ left: 10, top: 20, width: 120, height: 46, right: 130, bottom: 66, x: 10, y: 20, toJSON() {} }) as DOMRect;
    const captured = captureButton(button)!;
    expect(captured.text).toBe("ENTER");
    expect(captured.background).toBe("#111827");
    expect(captured.color).toBe("#f7f9fc");
    expect(captured.borderColor).toBe("#111827");
    expect(captured.box).toEqual({ left: 10, top: 20, width: 120, height: 46 });
  });

  it("ignores the hover state a tap leaves on a touch screen (its look does not change there)", async () => {
    const { showsHoverLook } = await import("@/app/components/preload/gate-scene");
    const el = document.createElement("button");
    el.matches = (sel: string) => sel === ":hover";
    const original = window.matchMedia;
    try {
      window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
      expect(showsHoverLook(el)).toBe(false);
      window.matchMedia = ((q: string) => ({ matches: true, media: q })) as unknown as typeof window.matchMedia;
      expect(showsHoverLook(el)).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it("returns nothing for a button that is not on screen", () => {
    document.body.innerHTML = "<button>ENTER</button>";
    expect(captureButton(document.querySelector("button"))).toBeNull();
    expect(captureButton(null)).toBeNull();
  });
});
