import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Opening a modal or the account panel locks the page scroll. The scrollbar's space must stay reserved while it is
// hidden, and must be reserved exactly once: `html { scrollbar-gutter: stable }` keeps it, so no code may add its own
// padding on top (that moved the page by the scrollbar's width, measured in Chrome: see the PR description).
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const globalsCss = read("app/globals.css");
const userMenu = read("app/components/auth/UserMenu.tsx");

describe("scroll lock does not shift the layout", () => {
  it("html always reserves the scrollbar gutter (single edge, so nothing is added on the left)", () => {
    const rule = /(^|\n)\s*html\s*\{[^}]*scrollbar-gutter:\s*stable\s*;[^}]*\}/.exec(globalsCss);
    expect(rule).not.toBeNull();
    expect(globalsCss).not.toMatch(/scrollbar-gutter:\s*stable\s+both-edges/);
  });

  it("the account panel locks the root only: body.style.overflow would make the body a scroller and the sticky bar would rise", () => {
    // Measured in Chrome (scripts/dev/measure-topbar-jump.cjs): html + body overflow:hidden => body becomes a scroll
    // container, the sticky top bar lost its viewport anchor (top = -scrollY, up to a few px) and the page shifted
    // sideways when the focus moved into the sliding panel.
    expect(userMenu).toMatch(/root\.style\.overflow = "hidden"/);
    expect(userMenu).not.toMatch(/body\.style\.overflow/);
    expect(userMenu).not.toMatch(/bodyOverflow/);
    expect(userMenu).toMatch(/focus\(\{ preventScroll: true \}\)/);
  });

  it("the account panel pads the body only by the MEASURED growth of the page width", () => {
    expect(userMenu).toMatch(/const grew = body\.getBoundingClientRect\(\)\.width - widthBefore/);
    expect(userMenu).toMatch(/if \(grew > 0\.5\) body\.style\.paddingRight/);
    expect(userMenu).not.toMatch(/if \(scrollbar > 0\) body\.style\.paddingRight/);
  });

  it("no code sets position/top/overflow on the body to freeze the page (the sticky top bar must stay put)", () => {
    expect(globalsCss).not.toMatch(/body\s*\{[^}]*position:\s*fixed/);
    expect(userMenu).not.toMatch(/body\.style\.(position|top|overflow)/);
  });

  it("no other component compensates the scrollbar with padding on html/body", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(tsx?|css)$/.test(entry.name) && !rel.endsWith("UserMenu.tsx") && /(body|documentElement|root)\.style\.(paddingRight|marginRight)/.test(read(rel))) offenders.push(rel);
      }
    };
    walk("app");
    walk("components");
    expect(offenders).toEqual([]);
  });
});
