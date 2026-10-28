/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BellIcon,
  BellOffIcon,
  BellRingIcon,
  SubscribeCheckIcon,
} from "@/app/components/icons/MarkerBellIcons";

describe("marker bell icons", () => {
  it.each([
    ["bell", BellIcon],
    ["bell-off", BellOffIcon],
    ["bell-ring", BellRingIcon],
    ["subscribe-check", SubscribeCheckIcon],
  ])("%s is a decorative 24-grid currentColor stroke icon with plain paths", (_name, Icon) => {
    const { container } = render(<Icon size={16} className="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("class")).toBe("x");
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it.each([
    ["bell", BellIcon],
    ["bell-off", BellOffIcon],
    ["bell-ring", BellRingIcon],
    ["subscribe-check", SubscribeCheckIcon],
  ])("%s draws the same pen as Szeruj/Lajk (1.2px on screen) at every size", (name, Icon) => {
    for (const size of [16, 22, 24]) {
      const { container, unmount } = render(<Icon size={size} />);
      const strokeWidth = Number(container.querySelector("svg")!.getAttribute("stroke-width"));
      expect(strokeWidth * (size / 24), `${name} ${size}px`).toBeCloseTo(1.2, 2);
      unmount();
    }
    const { container } = render(<Icon size={22} strokeWidth={2} />);
    expect(container.querySelector("svg")!.getAttribute("stroke-width")).toBe("2");
  });

  it("the top bar bell is 24px and the lens/close 22px, thin pen like Szeruj (16px, strokeWidth 1.8) and Lajk", () => {
    const bell = readFileSync("app/components/notifications/NotificationBell.tsx", "utf8");
    expect(bell).toContain("<BellIcon size={24}");
    expect(readFileSync("app/components/ShareButton.tsx", "utf8")).toMatch(/<Send[^>]*h-4 w-4[^>]*strokeWidth=\{1\.8\}/);
    const hero = readFileSync("app/components/Hero.tsx", "utf8");
    expect(hero.match(/h-4 w-4 shrink-0[\s\S]{0,200}?strokeWidth=\{1\.8\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
