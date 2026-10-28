/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AlertIcon, CloseIcon, RefreshIcon, SearchIcon, SpinnerArcIcon } from "@/app/components/icons/MarkerUiIcons";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");
const css = read("app/globals.css").replace(/\r\n/g, "\n");

/** The declarations of the FIRST rule whose selector is exactly `selector` (comments stripped). */
function rule(selector: string): string {
  const start = css.indexOf(`
  ${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("buffering spinner (set B, Marker)", () => {
  afterEach(() => cleanup());

  it(".mc-spinner has no disc, border, blur or ring: only a size, white and the contour glow", () => {
    const body = rule(".mc-spinner");
    expect(body).not.toMatch(/background/);
    expect(body).not.toMatch(/border/);
    expect(body).not.toMatch(/box-shadow/);
    expect(body).not.toMatch(/backdrop-filter/);
    expect(body).toMatch(/width:48px; height:48px/);
    expect(body).toContain("color:#fff");
    // the glow follows the shape of the arc (drop-shadow), like the big play mark
    expect(body).toContain("drop-shadow(");
    expect(css).not.toContain(".mc-spinner-ring");
  });

  it("the arc turns with a CSS animation; reduced motion slows it down instead of stopping it", () => {
    expect(rule(".mc-spinner-arc")).toMatch(/animation:mc-spin \.9s linear infinite/);
    expect(css).toContain("@keyframes mc-spin");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)", css.indexOf(".mc-spinner-arc {")));
    expect(reduced).toMatch(/\.mc-spinner-arc\s*\{\s*animation-duration:3\.2s;\s*\}/);
    expect(reduced).not.toMatch(/\.mc-spinner-arc\s*\{\s*animation:none/);
  });

  it("is the same size as the big play mark", () => {
    expect(rule(".mc-hero-icon")).toMatch(/width:48px; height:48px/);
    expect(rule(".mc-spinner-arc")).toMatch(/width:48px; height:48px/);
  });

  it("every spinner in and around the player uses the one Marker arc (no CSS ring, no lucide loader)", () => {
    for (const file of [
      "app/components/player/PolutekControls.tsx",
      "app/components/PlayerLoadingState.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toContain("SpinnerArcIcon");
      expect(source, file).not.toContain("lucide-react");
      expect(source, file).not.toMatch(/border-top-color|border:\s*\d+px solid rgba/);
    }
    expect(read("app/components/PlayerLoadingState.tsx")).not.toContain("polutek-start-spin ");
  });

  it("renders as one unfilled round-capped stroke of the set weight", () => {
    const view = render(<SpinnerArcIcon className="mc-spinner-arc" />);
    const svg = view.container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2.4");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelectorAll("path")).toHaveLength(1);
  });
});

describe("error, refresh, lens and close icons (set B, Marker)", () => {
  afterEach(() => cleanup());

  const icons = { AlertIcon, RefreshIcon, SearchIcon, CloseIcon, SpinnerArcIcon };

  it("are plain JSX with the same stroke as the bell: 2.4 in the 24 box, so 2px at 20px", () => {
    for (const [name, Icon] of Object.entries(icons)) {
      const view = render(<Icon size={20} />);
      const svg = view.container.querySelector("svg")!;
      expect(svg.getAttribute("width"), name).toBe("20");
      expect(svg.getAttribute("stroke-width"), name).toBe("2.4");
      expect(svg.getAttribute("stroke-linejoin"), name).toBe("round");
      expect(svg.querySelectorAll("path").length, name).toBeGreaterThan(0);
      for (const path of Array.from(svg.querySelectorAll("path"))) expect(path.getAttribute("fill")).toBeNull();
      view.unmount();
    }
  });

  it("the source has no raw HTML injection and no lucide", () => {
    const source = read("app/components/icons/MarkerUiIcons.tsx");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("lucide");
  });

  it("the error screens, the search box and its close button use them instead of lucide", () => {
    const overlay = read("app/components/PlayerErrorOverlay.tsx");
    expect(overlay).toContain("AlertIcon");
    expect(overlay).toContain("RefreshIcon");
    expect(overlay).not.toContain("lucide-react");

    const wrapper = read("app/components/PremiumWrapper.tsx");
    expect(wrapper).toContain("AlertIcon");
    expect(wrapper).toContain("RefreshIcon");

    const navbar = read("app/components/Navbar.tsx");
    expect(navbar.match(/<SearchIcon size=\{20\}/g)).toHaveLength(3);
    expect(navbar.match(/<CloseIcon size=\{20\}/g)).toHaveLength(1);
    expect(navbar).not.toMatch(/import \{[^}]*\b(Search|X)\b[^}]*\} from "lucide-react"/);
    expect(navbar).not.toContain("<Search ");
  });
});
