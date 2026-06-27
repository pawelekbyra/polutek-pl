import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("AccessLockOverlay CTA and accessibility verification", () => {
  it("has visible login button in LOGIN_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain("SignInButton");
    expect(source).toContain('cta: "Zaloguj się, aby obczaić"');
    expect(source).toContain("focus-visible:outline");
  });

  it("has visible support button in PATRON_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain('cta: "Odblokuj dostęp"');
    expect(source).toContain('href="#donations"');
    expect(source).toContain("scrollIntoView");
  });

  it("respects reduced motion", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain("motion-reduce:transition-none");
  });
});
