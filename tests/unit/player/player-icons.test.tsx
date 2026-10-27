/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PauseGlyph, PlayGlyph, PlayPauseGlyph, ReplayGlyph } from "@/app/components/player/controls/PlayerIcons";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("player icon family", () => {
  afterEach(() => cleanup());

  it("play is a round-joined triangle whose centroid is the box centre", () => {
    const view = render(<PlayGlyph />);
    const path = view.container.querySelector("path")!;
    expect(path.getAttribute("stroke-linejoin")).toBe("round");
    const points = [...path.getAttribute("d")!.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(points).toHaveLength(3);
    const cx = points.reduce((a, p) => a + p[0], 0) / 3;
    const cy = points.reduce((a, p) => a + p[1], 0) / 3;
    expect(Math.abs(cx - 12)).toBeLessThan(0.1);
    expect(Math.abs(cy - 12)).toBeLessThan(0.1);
  });

  it("pause is two soft bars, symmetric about the centre", () => {
    const view = render(<PauseGlyph />);
    const bars = [...view.container.querySelectorAll("rect")].map((r) => ({
      x: Number(r.getAttribute("x")), w: Number(r.getAttribute("width")), rx: Number(r.getAttribute("rx")),
    }));
    expect(bars).toHaveLength(2);
    expect(bars[0].rx).toBeGreaterThanOrEqual(1.5);
    expect((bars[0].x + bars[1].x + bars[1].w) / 2).toBeCloseTo(12, 5);
  });

  it("replay is an open arc with round caps, hidden from assistive tech", () => {
    const view = render(<ReplayGlyph />);
    const svg = view.container.querySelector("svg")!;
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("the swap keeps both glyphs and flips only a data attribute", () => {
    const view = render(<PlayPauseGlyph paused />);
    expect(view.container.querySelector('[data-testid="play-icon"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="pause-icon"]')).not.toBeNull();
    expect(view.container.querySelector(".mc-glyph-swap")?.getAttribute("data-state")).toBe("paused");
    view.rerender(<PlayPauseGlyph paused={false} />);
    expect(view.container.querySelector(".mc-glyph-swap")?.getAttribute("data-state")).toBe("playing");
  });

  it("styles: soft glass, press scale, blue focus ring, reduced motion, safe-area insets", () => {
    expect(css).toContain("rgba(14,15,18,.58)");
    expect(css).toContain("inset 0 0 0 1px rgba(255,255,255,.14)");
    expect(css).toContain(".mc-play:active { transform: scale(.96); }");
    expect(css).toContain("0 0 0 4px var(--chan-blue)");
    expect(css).toMatch(/\.mc-glyph-swap > svg,\s*\n\s*\.mc-vol-slider/);
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("env(safe-area-inset-left, 0px)");
  });
});
