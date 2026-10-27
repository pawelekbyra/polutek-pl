/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";
import PolutekWordmark from "@/app/components/brand/PolutekWordmark";
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
      expect(container.querySelector("text")).toBeNull();
      expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(1);
    });

    it("draws the play badge (brand blue, white triangle) to the left of the wordmark by default; POLUTEK is ink and the small .COM is blue", () => {
      const { container } = render(<BrandName variant="wordmark" />);
      const svg = container.firstElementChild as SVGElement;
      const paths = Array.from(container.querySelectorAll("path"));

      expect(svg.getAttribute("data-brand-badge")).toBe("true");
      expect(paths).toHaveLength(4);
      // flat blue badge (no outline), white triangle, navy POLUTEK, blue .COM
      expect(paths[0].getAttribute("style")).toContain("--chan-blue");
      expect(paths[1].getAttribute("fill")).toBe("#fff");
      expect(paths[2].getAttribute("style")).toContain("--brand-navy");
      // the small .COM is the Subscribe-button blue (--chan-blue)
      expect(paths[3].getAttribute("style")).toContain("--chan-blue");
      // the badge is 1.2 x cap tall: the lockup viewBox is 120 units high
      expect(svg.getAttribute("viewBox")?.split(" ")[3]).toBe("120");
    });

    it("can be drawn without the badge (text only)", () => {
      const { container } = render(<PolutekWordmark badge={false} />);
      const svg = container.firstElementChild as SVGElement;

      expect(svg.getAttribute("data-brand-badge")).toBe("false");
      expect(container.querySelectorAll("path")).toHaveLength(2);
      expect(svg.getAttribute("viewBox")?.split(" ")[3]).toBe("102.4");
    });

    it("is hidden from assistive tech when decorative", () => {
      const { container } = render(<BrandName variant="wordmark" decorative />);
      const svg = container.firstElementChild;

      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("role")).toBeNull();
      expect(svg?.getAttribute("aria-label")).toBeNull();
    });

    it("is height-driven: the caller's class wins over the default height", () => {
      const { container } = render(<BrandName variant="wordmark" className="h-[30px]" />);
      const cls = container.firstElementChild?.getAttribute("class") ?? "";

      expect(cls).toContain("h-[30px]");
      expect(cls).not.toContain(" h-[21px]");
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
