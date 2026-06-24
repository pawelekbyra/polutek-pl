import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("AccessLockOverlay CTA and accessibility verification", () => {
  it("has visible login button in LOGIN_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain("SignInButton");
    expect(source).toContain('isPl ? "Zaloguj się" : "Sign in"');
    // Ensure it's not just the transparent full-overlay button
    expect(source).toContain('rounded-full bg-white px-8 py-3');
  });

  it("has visible support button in PATRON_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain('isPl ? "Wesprzyj jednorazowo" : "One-time support"');
    expect(source).toContain('href="#support"');
    expect(source).toContain("scrollIntoView");
  });

  it("respects reduced motion", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain("motion-reduce:transition-none");
    expect(source).toContain("motion-reduce:hidden");
  });
});
