/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

// The top bar: nav `py-[3px]` around a row of 40px controls, plus the 1px line under it (47px). The logo sits in a link
// with `min-h-10 py-1`, so the bar follows the logo (the glasses variant is taller on desktop and grows the bar by itself).
// jsdom has no layout, so this pins the classes and the arithmetic (the real heights and margins were measured in Chrome,
// see the PR description).
const navbarSource = readFileSync(path.join(process.cwd(), "app/components/Navbar.tsx"), "utf8");
const channelHomeSource = readFileSync(path.join(process.cwd(), "app/components/ChannelHome.tsx"), "utf8");
const globalsCss = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

const CONTROL = 40; // h-10: search, language, bell, avatar, sign-in
const NAV_PAD = 3; // py-[3px] on the nav, top and bottom
const LINE = 1; // the bar's bottom line
const LINK_PAD = 4; // py-1 on the logo link

function logoHeights(variant: "wordmark" | "glasses") {
  const { container } = render(<BrandName variant={variant} decorative />);
  const el = container.querySelector(variant === "wordmark" ? "svg" : "img");
  const cls = (el?.getAttribute("class") ?? "").split(/\s+/);
  // "h-[21px]" (prefix "") or "md:h-[25px]" (prefix "md:"); other breakpoints (max-[350px]:) do not match
  const at = (prefix: string) => {
    const hit = cls.find((c) => c.startsWith(`${prefix}h-[`) && c.endsWith("px]"));
    return hit ? Number(hit.slice(prefix.length + 3, -3)) : Number.NaN;
  };
  const base = at("");
  const md = Number.isFinite(at("md:")) ? at("md:") : base;
  return { phone: base, md };
}
const barHeight = (logoH: number) => NAV_PAD * 2 + Math.max(CONTROL, logoH + LINK_PAD * 2) + LINE;

describe("the top bar: even margins, and the logo decides its height", () => {
  afterEach(() => cleanup());

  it("nav and link use plain symmetric padding (no negative-margin tricks) around 40px controls", () => {
    const nav = navbarSource.match(/<nav aria-label=\{navLabel\} className="([^"]+)"/)?.[1].split(/\s+/) ?? [];
    const link = (navbarSource.match(/<BrandHomeLink[\s\S]*?className="([^"]+)"/)?.[1] ?? "").split(/\s+/);

    expect(nav).toContain("py-[3px]");
    expect(nav).toContain("items-center");
    expect(nav.some((c) => /^(min-h|h|pt|pb)-/.test(c))).toBe(false);
    expect(link).toContain("min-h-10");
    expect(link).toContain("py-1");
    expect(link).toContain("items-center");
    expect(link.some((c) => /^-m[trblxy]?-/.test(c) || /^h-/.test(c))).toBe(false);
    // every control in the bar is 40px (h-10); no 38px leftovers
    expect(navbarSource).not.toContain("h-[38px]");
    expect(navbarSource).toContain("h-10 w-10");
  });

  it("--header-h in globals.css is the phone bar height: 3 + 40 + 3 + 1 line", () => {
    const value = Number(globalsCss.match(/--header-h:\s*(\d+)px/)?.[1]);

    expect(value).toBe(NAV_PAD * 2 + CONTROL + LINE);
    expect(value).toBe(47);
  });

  it.each([
    ["wordmark", 47, 47],
    ["glasses", 47, 49],
  ] as const)("with the %s logo the bar is %ipx on phones and %ipx from md up, logo margins top = bottom", (variant, phoneBar, mdBar) => {
    const h = logoHeights(variant);

    expect(barHeight(h.phone)).toBe(phoneBar);
    expect(barHeight(h.md)).toBe(mdBar);
    for (const logoH of [h.phone, h.md]) {
      const box = Math.max(CONTROL, logoH + LINK_PAD * 2); // the link box, centred in the nav
      const top = NAV_PAD + (box - logoH) / 2;
      const bottomToLine = NAV_PAD + (box - logoH) / 2;
      expect(top).toBe(bottomToLine);
    }
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
