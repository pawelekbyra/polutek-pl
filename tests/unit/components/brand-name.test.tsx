/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";
import { BRAND_LOGO_VARIANT } from "@/lib/ui-flags";

describe("BrandName (the header logo, one switch: BRAND_LOGO_VARIANT)", () => {
  afterEach(() => cleanup());

  it("ships the wordmark as the site logo", () => {
    expect(BRAND_LOGO_VARIANT).toBe("wordmark");
    const { container } = render(<BrandName />);
    expect(container.querySelector('svg[data-brand-logo="wordmark"]')).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  describe("wordmark variant", () => {
    it("is an accessible image named POLUTEK.COM, drawn as paths (no <text>)", () => {
      const { container } = render(<BrandName variant="wordmark" />);
      const svg = screen.getByRole("img", { name: "POLUTEK.COM" });

      expect(svg.tagName.toLowerCase()).toBe("svg");
      expect(container.querySelectorAll("path").length).toBe(2);
      expect(container.querySelector("text")).toBeNull();
    });

    it("is hidden from assistive tech when decorative", () => {
      const { container } = render(<BrandName variant="wordmark" decorative />);
      const svg = container.firstElementChild;

      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("role")).toBeNull();
      expect(svg?.getAttribute("aria-label")).toBeNull();
    });

    it("is height-driven: the caller's class wins over the default height", () => {
      const { container } = render(<BrandName variant="wordmark" className="h-[21px]" />);
      const cls = container.firstElementChild?.getAttribute("class") ?? "";

      expect(cls).toContain("h-[21px]");
      expect(cls).not.toContain(" h-[18px]");
      expect(cls).toContain("w-auto");
    });
  });

  describe("glasses variant (kept, hidden, restorable)", () => {
    it("renders the glasses-mark logo image", () => {
      render(<BrandName variant="glasses" />);
      const img = screen.getByAltText("www.pawelperfect.com");

      expect(img.getAttribute("src")).toBe("/logo-glasses.svg");
    });

    it("is decorative (aria-hidden, empty alt) when its parent already supplies the accessible name", () => {
      const { container } = render(<BrandName variant="glasses" decorative />);
      const mark = container.firstElementChild;

      expect(mark?.getAttribute("aria-hidden")).toBe("true");
      expect(mark?.getAttribute("alt")).toBe("");
    });

    it("lets the caller size the mark via className", () => {
      const { container } = render(<BrandName variant="glasses" className="h-[40px]" />);

      expect(container.firstElementChild?.className).toContain("h-[40px]");
    });
  });
});
