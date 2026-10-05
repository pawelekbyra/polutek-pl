/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import BrandHomeLink from "@/app/components/BrandHomeLink";

describe("BrandHomeLink (the logo in the top bar)", () => {
  const scrollTo = vi.fn();
  beforeEach(() => {
    scrollTo.mockReset();
    vi.stubGlobal("scrollTo", scrollTo);
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("is a real link to the Polish home page with a Polish accessible name", () => {
    render(<BrandHomeLink language="pl"><span /></BrandHomeLink>);
    const link = screen.getByRole("link", { name: "pawelperfect.com, strona główna" });
    expect(link.getAttribute("href")).toBe("/");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("links to the English home page in English", () => {
    render(<BrandHomeLink language="en"><span /></BrandHomeLink>);
    const link = screen.getByRole("link", { name: "pawelperfect.com, home page" });
    expect(link.getAttribute("href")).toBe("/en");
  });

  it("navigates normally (no preventDefault, no scrolling) when not on the home page", () => {
    render(<BrandHomeLink language="pl"><span /></BrandHomeLink>);
    const notPrevented = fireEvent.click(screen.getByRole("link"));
    expect(notPrevented).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("on the home page scrolls to the top instead of navigating (no reload flash)", () => {
    render(<BrandHomeLink language="pl" isHome><span /></BrandHomeLink>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-current")).toBe("page");
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("scrolls without animation for reduced motion", () => {
    window.matchMedia = ((query: string) => ({ matches: true, media: query })) as unknown as typeof window.matchMedia;
    render(<BrandHomeLink language="pl" isHome><span /></BrandHomeLink>);
    fireEvent.click(screen.getByRole("link"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("leaves Ctrl/Cmd/Shift/middle clicks to the browser even on the home page", () => {
    render(<BrandHomeLink language="pl" isHome><span /></BrandHomeLink>);
    const link = screen.getByRole("link");
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
