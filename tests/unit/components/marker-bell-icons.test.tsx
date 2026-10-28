/** @vitest-environment jsdom */
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
});
