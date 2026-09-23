/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("renders the glasses-mark logo image by default", () => {
    render(<BrandName />);
    const img = screen.getByAltText("www.pawelperfect.pl");

    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("/logo-glasses.svg");
  });

  it("is decorative (aria-hidden, empty alt) when its parent already supplies the accessible name", () => {
    const { container } = render(<BrandName decorative />);
    const mark = container.firstElementChild;

    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.getAttribute("alt")).toBe("");
  });

  it("is not aria-hidden when not decorative", () => {
    const { container } = render(<BrandName />);
    const mark = container.firstElementChild;

    expect(mark?.getAttribute("aria-hidden")).toBeNull();
  });

  it("lets the caller size the mark via className", () => {
    const { container } = render(<BrandName className="h-[28px]" />);
    const mark = container.firstElementChild;

    expect(mark?.className).toContain("h-[28px]");
  });
});
