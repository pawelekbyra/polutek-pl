/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("renders the KUTASHI.COM wordmark as an accessible image by default", () => {
    render(<BrandName />);
    const mark = screen.getByRole("img", { name: "KUTASHI.COM" });
    expect(mark.textContent).toBe("KUTASHI.COM");
  });

  it("is decorative when its parent already supplies the accessible name", () => {
    const { container } = render(<BrandName decorative />);
    const mark = container.querySelector("span");

    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.hasAttribute("aria-label")).toBe(false);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("lets the caller size the mark via className", () => {
    render(<BrandName className="text-[20px]" />);
    const mark = screen.getByRole("img", { name: "KUTASHI.COM" });

    expect(mark.className).toContain("text-[20px]");
  });
});
