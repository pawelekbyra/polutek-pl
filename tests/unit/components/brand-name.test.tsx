/** @vitest-environment jsdom */

import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

const repoRoot = process.cwd();

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("keeps the original vector geometry while rendering it inline", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "public/logo-glasses.svg"),
      "utf8",
    );
    const expectedPaths = Array.from(source.matchAll(/<path\b[^>]*d="([^"]+)"/g), (
      match,
    ) => match[1]);

    const { container } = render(<BrandName shine={false} />);
    const renderedPaths = Array.from(
      container.querySelectorAll("svg > g[aria-hidden='true'] > path"),
      (node) => node.getAttribute("d"),
    );

    expect(expectedPaths).toHaveLength(5);
    expect(renderedPaths).toEqual(expectedPaths);
    expect(
      screen
        .getByRole("img", { name: "POLUTEK.PL" })
        .getAttribute("shape-rendering"),
    ).toBe("geometricPrecision");
  });

  it("uses unique SVG definition IDs for simultaneous instances", () => {
    const { container } = render(
      <>
        <BrandName shine="hover" />
        <BrandName shine="ambient" />
      </>,
    );
    const definitionIds = Array.from(
      container.querySelectorAll("linearGradient[id], clipPath[id]"),
      (node) => node.id,
    );

    expect(definitionIds).toHaveLength(4);
    expect(new Set(definitionIds).size).toBe(definitionIds.length);
    expect(container.querySelectorAll("clipPath")).toHaveLength(2);
    expect(
      container.querySelectorAll(
        "rect[fill^='url(#polutek-logo-shine-']",
      ),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll(
        "g[clip-path^='url(#polutek-logo-lens-clip-']",
      ),
    ).toHaveLength(2);
  });

  it("can be decorative when its parent already supplies the accessible name", () => {
    const { container } = render(<BrandName decorative />);
    const logo = container.querySelector("svg");

    expect(logo?.getAttribute("aria-hidden")).toBe("true");
    expect(logo?.hasAttribute("role")).toBe(false);
    expect(logo?.querySelector("title")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("fully disables both shine animations for reduced motion", () => {
    const styles = fs.readFileSync(
      path.join(repoRoot, "app/components/BrandName.module.css"),
      "utf8",
    );
    const reducedMotion = styles.slice(
      styles.indexOf("@media (prefers-reduced-motion: reduce)"),
      styles.indexOf("@media (forced-colors: active)"),
    );

    expect(reducedMotion).toContain("animation: none");
    expect(reducedMotion).toContain("opacity: 0");
    expect(styles).not.toContain("filter:");
  });
});
