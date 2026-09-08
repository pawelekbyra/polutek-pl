/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("renders the glasses logo as an accessible image by default", () => {
    render(<BrandName />);
    const img = screen.getByRole("img", { name: "www.pawelperfect.pl" });
    expect(img.getAttribute("src")).toBe("/logo-glasses.svg");
  });

  it("is decorative when its parent already supplies the accessible name", () => {
    const { container } = render(<BrandName decorative />);
    const img = container.querySelector("img");

    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("lets the caller size the mark via className", () => {
    render(<BrandName className="h-[28px]" />);
    const img = screen.getByRole("img", { name: "www.pawelperfect.pl" });

    expect(img.className).toContain("h-[28px]");
  });
});
