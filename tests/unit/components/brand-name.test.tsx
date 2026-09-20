/** @vitest-environment jsdom */

// NOTE: BrandName currently renders a temporary text wordmark ("KUTASHI.COM") behind the
// TEMP_LOGO_AS_TEXT flag in app/components/BrandName.tsx — see CLAUDE.md "2026-09-20:
// temporary test-mode UI changes" for the exact revert steps. These tests cover that
// temporary behavior; when TEMP_LOGO_AS_TEXT is reverted to `false`, restore the original
// assertions (an accessible <img src="/logo-glasses.svg"> with alt "www.pawelperfect.pl").

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("renders the KUTASHI.COM text wordmark by default", () => {
    render(<BrandName />);
    expect(screen.getByText("KUTASHI")).not.toBeNull();
    expect(screen.getByText(".COM")).not.toBeNull();
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
