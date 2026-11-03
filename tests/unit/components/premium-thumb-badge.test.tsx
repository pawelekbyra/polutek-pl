/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PremiumThumbBadge } from "@/app/components/premium-pass/PremiumBadge";

// The plate on premium-zone tiles reads PREMIUM (owner decision 2026-11-03), never PATRON.
import { vi } from "vitest";
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ tx: (pl: string) => pl, language: "pl" }) }));
describe("PremiumThumbBadge", () => {
  it("shows PREMIUM on a locked and on an unlocked tile", () => {
    const { unmount } = render(<PremiumThumbBadge locked />);
    expect(screen.getByText("PREMIUM")).toBeInTheDocument();
    expect(screen.queryByText("PATRON")).not.toBeInTheDocument();
    unmount();
    render(<PremiumThumbBadge locked={false} />);
    expect(screen.getByText("PREMIUM")).toBeInTheDocument();
  });
});
