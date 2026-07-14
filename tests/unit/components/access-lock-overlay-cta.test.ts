import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("AccessLockOverlay CTA and accessibility verification", () => {
  it("has visible login button in LOGIN_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain('openAuthModal("sign-in")');
    expect(source).toContain('type="button"');
    expect(source).toContain("Zaloguj się");
  });

  it("has visible support button in PATRON_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain('href="#donations"');
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("Wesprzyj jednorazowo");
  });

  it("uses the shared action and patron tokens", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    const styles = component("app/components/AccessLockOverlay.module.css");

    expect(styles).toContain("var(--chan-blue)");
    expect(styles).toContain("var(--chan-amber)");
    expect(styles).toContain("var(--chan-amber-ink)");
  });
});
