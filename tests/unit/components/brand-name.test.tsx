/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("renders the KUTASHI.COM text wordmark", () => {
    const { container } = render(<BrandName />);

    expect(container.textContent).toBe("KUTASHI.COM");
  });

  it("is decorative (aria-hidden) when its parent already supplies the accessible name", () => {
    const { container } = render(<BrandName decorative />);
    const mark = container.firstElementChild;

    expect(mark?.getAttribute("aria-hidden")).toBe("true");
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
