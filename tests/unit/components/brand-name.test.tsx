/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandName from "@/app/components/BrandName";
import { enterGlyphFilledPath } from "@/lib/icons/app-icon";

describe("BrandName", () => {
  afterEach(() => cleanup());

  it("renders the POLUTEK.PL wordmark split into an ink and a blue span", () => {
    render(<BrandName />);
    const logo = screen.getByRole("img", { name: "POLUTEK.PL" });

    expect(logo.textContent).toBe("POLUTEK.PL");
    expect(screen.getByText("POLUTEK").className).toContain("font-brandLogo");
    expect(screen.getByText(".PL").className).toContain("font-brandLogo");
  });

  it("renders the app-icon mark next to the wordmark by default", () => {
    const { container } = render(<BrandName />);
    const path = container.querySelector("svg path");

    expect(path?.getAttribute("d")).toBe(enterGlyphFilledPath(64).path);
  });

  it("can omit the mark for tight layouts", () => {
    const { container } = render(<BrandName mark={false} />);

    expect(container.querySelector("svg")).toBeNull();
  });

  it("can be decorative when its parent already supplies the accessible name", () => {
    const { container } = render(<BrandName decorative />);
    const logo = container.querySelector('span[aria-hidden="true"]');

    expect(logo?.hasAttribute("role")).toBe(false);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
