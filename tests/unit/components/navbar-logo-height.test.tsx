/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

// The top bar is `min-h-[54px]` with a 38px content row (search field, avatar). The logo must never
// add height: jsdom has no layout, so this pins the classes that guarantee it (the real heights were
// measured in a browser harness, see the PR description).
const navbarSource = readFileSync(path.join(process.cwd(), "app/components/Navbar.tsx"), "utf8");
const channelHomeSource = readFileSync(path.join(process.cwd(), "app/components/ChannelHome.tsx"), "utf8");

describe("the logo does not influence the height of the top bar", () => {
  afterEach(() => cleanup());

  it("the link is a 44px touch target pulled back with -my-[3px], so the bar still gets 38px from it", () => {
    const link = navbarSource.match(/<BrandHomeLink[\s\S]*?className="([^"]+)"/)?.[1] ?? "";
    const classes = link.split(/\s+/);

    expect(classes).toContain("h-[44px]");
    expect(classes).toContain("-my-[3px]");
    expect(classes).toContain("p-0");
    expect(classes).not.toContain("py-1");
    expect(classes.some((c) => /^min-h-/.test(c))).toBe(false);
    expect(navbarSource).toContain("min-h-[54px]");
  });

  it.each([
    ["wordmark", "svg"],
    ["glasses", "img"],
  ] as const)("the %s mark has a fixed height below the 38px row and no margin, padding or min-height", (variant, tag) => {
    const { container } = render(<BrandName variant={variant} decorative />);
    const el = container.querySelector(tag);
    const cls = (el?.getAttribute("class") ?? "").split(/\s+/);

    expect(el).not.toBeNull();
    const heights = cls.map((c) => c.match(/(?:^|:)h-\[(\d+)px\]$/)?.[1]).filter(Boolean).map(Number);
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.max(...heights)).toBeLessThanOrEqual(34);
    expect(cls.some((c) => /^(?:m|mt|mb|my|p|pt|pb|py|min-h)-/.test(c) && !/^m-0$|^p-0$/.test(c))).toBe(false);
  });

  it("on phones the logo starts on the page gutter: nav px-2 + link ml-2 = 16px = the content wrapper's px-4", () => {
    const nav = navbarSource.match(/<nav aria-label=\{navLabel\} className="([^"]+)"/)?.[1].split(/\s+/) ?? [];
    const link = navbarSource.match(/<BrandHomeLink[\s\S]*?className="([^"]+)"/)?.[1].split(/\s+/) ?? [];
    const wrapper = channelHomeSource.match(/className="(mx-auto max-w-\[1180px\][^"]*)"/)?.[1].split(/\s+/) ?? [];
    const rem = (classes: string[], prefix: string) => Number(classes.find((c) => c.startsWith(`${prefix}-`))?.slice(prefix.length + 1)) * 4;

    expect(rem(nav, "px") + rem(link, "ml")).toBe(16);
    expect(rem(wrapper, "px")).toBe(16);
    // from md up the nav padding alone is the gutter (the link has md:ml-0), as in the wrapper
    expect(link).toContain("md:ml-0");
    expect(nav).toContain("md:px-6");
    expect(wrapper).toContain("md:px-6");
  });

  it("the wordmark svg is display:block (no inline baseline gap)", () => {
    const { container } = render(<BrandName variant="wordmark" decorative />);

    expect(container.querySelector("svg")?.getAttribute("class")).toContain("block");
  });
});
