/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrandName from "@/app/components/BrandName";
import PolutekWordmark from "@/app/components/brand/PolutekWordmark";
import { WORDMARK_BLUE_INK, WORDMARK_BLUE_PATH, WORDMARK_BLUE_VIEWBOX } from "@/app/components/brand/polutek-wordmark-blue-paths";
import { BRAND_LOGO_VARIANT } from "@/lib/ui-flags";

describe("BrandName (the header logo, one switch: BRAND_LOGO_VARIANT)", () => {
  afterEach(() => cleanup());

  it("ships the blue wordmark as the site logo (the older lockup and the glasses are kept, one switch away)", () => {
    expect(BRAND_LOGO_VARIANT).toBe("wordmark-blue");
    const { container } = render(<BrandName />);
    expect(container.querySelector('svg[data-brand-logo="wordmark-blue"]')).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  describe("wordmark-blue variant (the owner's POLUTEK image redrawn as SVG)", () => {
    it("is an accessible image named POLUTEK, one filled path, no <text>, no raster", () => {
      const { container } = render(<BrandName variant="wordmark-blue" />);
      const svg = screen.getByRole("img", { name: "POLUTEK" });

      expect(svg.tagName.toLowerCase()).toBe("svg");
      expect(container.querySelector("text")).toBeNull();
      expect(container.querySelector("image")).toBeNull();
      expect(container.querySelectorAll("path")).toHaveLength(1);
    });

    it("uses the --brand-ink token with the exact navy of the image (#01286a) as fallback, and a tight viewBox", () => {
      const { container } = render(<BrandName variant="wordmark-blue" />);
      const path = container.querySelector("path")!;

      expect(path.getAttribute("style")).toContain("var(--brand-ink, #01286a)");
      expect(path.getAttribute("d")?.startsWith("M")).toBe(true);
      expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(WORDMARK_BLUE_VIEWBOX);
      expect(WORDMARK_BLUE_VIEWBOX.startsWith("0 0 ")).toBe(true);
    });

    it("is hidden from assistive tech when decorative", () => {
      const { container } = render(<BrandName variant="wordmark-blue" decorative />);
      const svg = container.firstElementChild;

      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("role")).toBeNull();
      expect(svg?.getAttribute("aria-label")).toBeNull();
    });

    it("is height-driven: the caller's class wins over the default height", () => {
      const { container } = render(<BrandName variant="wordmark-blue" className="h-[30px]" />);
      const cls = container.firstElementChild?.getAttribute("class") ?? "";

      expect(cls).toContain("h-[30px]");
      expect(cls).toContain("w-auto");
    });

    it("the standalone files match the component path and carry role, label and title", () => {
      for (const file of ["polutek-wordmark-blue.svg", "polutek-wordmark-blue-mono.svg"]) {
        const svg = readFileSync(path.join(process.cwd(), "public/brand", file), "utf8");
        expect(svg).toContain('role="img"');
        expect(svg).toContain('aria-label="POLUTEK"');
        expect(svg).toContain("<title>POLUTEK</title>");
        expect(svg).toContain(`d="${WORDMARK_BLUE_PATH}"`);
        expect(svg).not.toMatch(/<image|<text|data:image/);
      }
      expect(readFileSync(path.join(process.cwd(), "public/brand/polutek-wordmark-blue.svg"), "utf8")).toContain(`fill="${WORDMARK_BLUE_INK}"`);
      expect(readFileSync(path.join(process.cwd(), "public/brand/polutek-wordmark-blue-mono.svg"), "utf8")).toContain('fill="currentColor"');
    });

    it("the colour token exists in globals.css with the same value", () => {
      const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
      expect(css).toContain(`--brand-ink: ${WORDMARK_BLUE_INK};`);
    });
  });

  describe("wordmark variant", () => {
    it("is an accessible image named POLUTEK.COM, drawn as paths (no <text>)", () => {
      const { container } = render(<BrandName variant="wordmark" />);
      const svg = screen.getByRole("img", { name: "POLUTEK.COM" });

      expect(svg.tagName.toLowerCase()).toBe("svg");
      expect(container.querySelector("text")).toBeNull();
      expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(1);
    });

    it("draws the play badge (brand blue, white triangle) to the left of the wordmark by default; POLUTEK is dark blue", () => {
      const { container } = render(<BrandName variant="wordmark" />);
      const svg = container.firstElementChild as SVGElement;
      const paths = Array.from(container.querySelectorAll("path"));

      expect(svg.getAttribute("data-brand-badge")).toBe("true");
      expect(paths).toHaveLength(3);
      // flat blue badge (no outline), white triangle, dark-blue POLUTEK; no ".COM" path (nothing else is blue)
      expect(paths[0].getAttribute("style")).toContain("--chan-blue");
      expect(paths[1].getAttribute("fill")).toBe("#fff");
      expect(paths[2].getAttribute("style")).toContain("--brand-ink-blue");
      expect(paths.filter((p) => (p.getAttribute("style") ?? "").includes("--chan-blue"))).toHaveLength(1);
      // the badge is 1.2 x cap tall: the lockup viewBox is 120 units high
      expect(svg.getAttribute("viewBox")?.split(" ")[3]).toBe("120");
    });

    it("can be drawn without the badge (text only)", () => {
      const { container } = render(<PolutekWordmark badge={false} />);
      const svg = container.firstElementChild as SVGElement;

      expect(svg.getAttribute("data-brand-badge")).toBe("false");
      expect(container.querySelectorAll("path")).toHaveLength(1);
      expect(container.querySelector("path")?.getAttribute("style")).toContain("--brand-ink-blue");
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

  describe("the three variants and the one-line switch (glasses <-> wordmark-blue <-> wordmark)", () => {
    afterEach(() => {
      vi.doUnmock("@/lib/ui-flags");
      vi.resetModules();
    });

    it.each([
      ["wordmark-blue", 'svg[data-brand-logo="wordmark-blue"]'],
      ["glasses", 'img[src="/logo-glasses.svg"]'],
      ["wordmark", 'svg[data-brand-logo="wordmark"]'],
    ] as const)("flipping BRAND_LOGO_VARIANT to %s renders that logo by default", async (variant, selector) => {
      vi.resetModules();
      vi.doMock("@/lib/ui-flags", async () => ({ ...(await vi.importActual<object>("@/lib/ui-flags")), BRAND_LOGO_VARIANT: variant }));
      const { default: Fresh } = await import("@/app/components/BrandName");
      const { container } = render(<Fresh decorative />);

      expect(container.querySelector(selector)).not.toBeNull();
    });

    it("the glasses assets stay in the repo, complete, and the archive copy is byte-identical", () => {
      const files = [
        "logo-glasses.svg", "icon-glasses.svg", "icon-glasses-32.png", "icon-glasses-180.png", "icon-glasses-192.png",
        "icon-glasses-512.png", "icon-glasses-maskable-512.png", "icon-glasses.ico",
      ];
      for (const f of files) {
        const live = readFileSync(path.join(process.cwd(), "public", f));
        const archived = readFileSync(path.join(process.cwd(), "public/brand/archive/glasses", f));
        expect(live.length).toBeGreaterThan(100);
        expect(archived.equals(live)).toBe(true);
      }
      expect(readFileSync(path.join(process.cwd(), "public/logo-glasses.svg"), "utf8")).toContain('viewBox="0 0 2048 506"');
    });

    it("the agent passphrase is documented where agents read (CLAUDE.md, AGENTS.md, architecture doc)", () => {
      for (const f of ["CLAUDE.md", "AGENTS.md", "docs/architecture/public-shell-and-player.md"]) {
        const text = readFileSync(path.join(process.cwd(), f), "utf8");
        expect(text).toContain("przywróć okularki");
        expect(text).toContain("BRAND_LOGO_VARIANT");
        expect(text).toContain("public/brand/archive/glasses");
      }
    });
  });

  describe("blue wordmark spacing (generator: EXTRA_GAP, optical, in source px; cap height 297.8 px)", () => {
    it("adds a moderate extra gap (at most 6% of the cap height each) and the viewBox follows the generator", async () => {
      const gen = await import("../../../scripts/brand/generate-wordmark-blue.mjs");

      for (const extra of Object.values(gen.EXTRA_GAP) as number[]) {
        expect(extra).toBeGreaterThan(0);
        expect(extra / 297.8).toBeLessThanOrEqual(0.06);
      }
      // L|U is the tightest pair in the original (foot of the L next to the U stem), so it gets the most
      expect(gen.EXTRA_GAP.U).toBe(Math.max(...(Object.values(gen.EXTRA_GAP) as number[])));
      expect(WORDMARK_BLUE_VIEWBOX).toBe(gen.VIEWBOX);
    });
  });
});
