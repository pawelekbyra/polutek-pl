/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CaptionsOffIcon,
  CaptionsOnIcon,
  PLAYER_ICONS,
  PAUSE_BAR_STROKE,
  PLAYER_ICON_STROKE,
  PauseIcon,
  PlayIcon,
  PlayPauseGlyph,
  ReplayIcon,
} from "@/app/components/player/controls/PlayerIconSet";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Keys of the design file (set B, "Marker") that the player has to carry. */
const SET_KEYS = [
  "play", "pause", "replay", "volume-high", "volume-low", "volume-muted", "captions-on", "captions-off", "chapters",
  "picture-in-picture", "settings", "fullscreen-enter", "fullscreen-exit", "check", "chevron-right", "speed", "back",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("player icon set (Marker)", () => {
  afterEach(() => cleanup());

  it("carries every icon of the set, no more and no less", () => {
    expect(Object.keys(PLAYER_ICONS).sort()).toEqual([...SET_KEYS].sort());
  });

  it.each(SET_KEYS)("%s is a decorative 24x24 stroke-only SVG with at least one path and no text", (key) => {
    const Icon = PLAYER_ICONS[key as keyof typeof PLAYER_ICONS];
    const view = render(<Icon className="mc-icon" testId="the-icon" />);
    const svg = view.container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("class")).toBe("mc-icon");
    expect(svg.getAttribute("data-testid")).toBe("the-icon");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe(String(PLAYER_ICON_STROKE));
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.textContent).toBe("");
    // Only paths, each with real path data inside the box (no fills, no scripts, no raw markup).
    const children = [...svg.children];
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(child.tagName.toLowerCase()).toBe("path");
      expect(child.getAttribute("d")).toMatch(/^M[\d.\s,CLMZHVcz-]+$/);
      expect(child.hasAttribute("fill")).toBe(false);
    }
  });

  it("the stroke can be tuned per use without touching the path data", () => {
    const view = render(<PlayIcon strokeWidth={2} />);
    expect(view.container.querySelector("svg")!.getAttribute("stroke-width")).toBe("2");
  });

  it("captions on and off differ by the slash and carry data-crossed", () => {
    const on = render(<CaptionsOnIcon data-crossed="false" />);
    expect(on.container.querySelectorAll("path")).toHaveLength(3);
    expect(on.container.querySelector("svg")!.getAttribute("data-crossed")).toBe("false");
    cleanup();
    const off = render(<CaptionsOffIcon data-crossed="true" />);
    expect(off.container.querySelectorAll("path")).toHaveLength(4);
    expect(off.container.querySelector("svg")!.getAttribute("data-crossed")).toBe("true");
  });

  it("play / pause / replay keep their parts: one shape, two bars, an arc with its arrowhead", () => {
    expect(render(<PlayIcon />).container.querySelectorAll("path")).toHaveLength(1);
    cleanup();
    expect(render(<PauseIcon />).container.querySelectorAll("path")).toHaveLength(2);
    cleanup();
    expect(render(<ReplayIcon />).container.querySelectorAll("path")).toHaveLength(2);
  });

  it("pause is two solid bars with their own width, wider than the set line and not thinned by the strokeWidth prop", () => {
    const view = render(<PauseIcon strokeWidth={1} />);
    const bars = [...view.container.querySelectorAll("path")];
    expect(bars).toHaveLength(2);
    for (const bar of bars) expect(bar.getAttribute("stroke-width")).toBe(String(PAUSE_BAR_STROKE));
    expect(PAUSE_BAR_STROKE).toBeGreaterThan(PLAYER_ICON_STROKE);
  });

  it("the white glow is only on the big centre mark, not on the control-bar glyphs", () => {
    expect(css).toMatch(/\.mc-hero-icon \{[^}]*rgba\(255,255,255/);
    const barRules = css.split("\n").filter((l) => /\.mc-(icon|glyph-swap|play)\b/.test(l) && /filter/.test(l));
    for (const l of barRules) expect(l).not.toMatch(/rgba\(255,\s*255,\s*255/);
  });

  it("the swap keeps both glyphs and flips only a data attribute", () => {
    const view = render(<PlayPauseGlyph paused />);
    expect(view.container.querySelector('[data-testid="play-icon"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="pause-icon"]')).not.toBeNull();
    expect(view.container.querySelector(".mc-glyph-swap")?.getAttribute("data-state")).toBe("paused");
    view.rerender(<PlayPauseGlyph paused={false} />);
    expect(view.container.querySelector(".mc-glyph-swap")?.getAttribute("data-state")).toBe("playing");
  });

  it("the set file is plain JSX: no raw HTML injection", () => {
    const source = readFileSync(join(process.cwd(), "app/components/player/controls/PlayerIconSet.tsx"), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("the player no longer uses lucide or the old custom glyphs (error overlay and loader keep theirs)", () => {
    const root = join(process.cwd(), "app/components/player");
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("lucide-react");
      expect(source, file).not.toContain("LINE_ICON");
      expect(source, file).not.toMatch(/b(PlayGlyph|PauseGlyph|ReplayGlyph)b/);
    }
  });

  it("styles: sizes come from CSS, soft glass, press scale, blue focus ring, reduced motion, safe-area insets", () => {
    expect(css).toMatch(/\.mc-icon\s*\{\s*width:20px; height:20px;/);
    expect(css).toMatch(/\.mc-hero-icon\s*\{ display:block; width:48px; height:48px;/);
    expect(css).toContain(".mc-menu-check, .mc-menu-hint-icon { width:16px; height:16px;");
    expect(css).not.toContain('content:"\\2713"');
    expect(css).toMatch(/\.mc-play \{ --mc-play-glyph: 26px; width:40px; height:40px; \}/);
    expect(css).toMatch(/\.mc-icon--volume \{ width:23px; height:23px; stroke-width:2\.09; \}/);
    expect(css).toMatch(/\.mc-glyph-swap > svg,\s*\n\s*\.mc-vol-slider/);
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("env(safe-area-inset-left, 0px)");
  });

  it("styles: play is a plain icon button (no pill, no ring of its own), CC stays full white, track is white", () => {
    const play = css.match(/\.mc-play \{[^}]*\}/g)!.join("\n");
    expect(play).not.toMatch(/background|box-shadow|backdrop-filter|border/);
    expect(css).not.toContain(".mc-play:active");
    expect(css).not.toContain(".mc-play:focus-visible");
    expect(css).toMatch(/\.mc-caption--none \{ cursor:default; \}/);
    expect(css).not.toMatch(/\.mc-caption--none[^}]*opacity/);
    expect(css.match(/\.mc-scrub-track \{[^}]*\}/)![0]).toContain("rgba(255,255,255,.88)");
    expect(css).toMatch(/\.mc-scrub-buffer \{[^}]*rgba\(255,255,255,\.55\)/);
    expect(css).toMatch(/\.mc-scrub-fill \{[^}]*var\(--chan-blue\)/);
  });
});
