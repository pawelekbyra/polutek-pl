import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("AccessLockOverlay CTA and accessibility verification", () => {
  it("has visible login button in LOGIN_REQUIRED state", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain('openAuthModal("sign-in")');
    // The whole login wall is one keyboard-operable button (role/tabIndex/Enter+Space).
    expect(source).toContain('role: "button"');
    expect(source).toContain("tabIndex: 0");
    expect(source).toContain('e.key === "Enter" || e.key === " "');
    expect(source).toContain("Zaloguj się");
  });

  it("never offers a pay-to-unlock CTA (support grants nothing, CLAUDE.md §4.4)", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).not.toContain('href="#donations"');
    expect(source).not.toContain("Odblokuj dostęp");
    expect(source).not.toContain("PATRON_REQUIRED");
  });

  it("keeps distinct login and coming-soon treatments with reduced-motion safety", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    const styles = component("app/components/AccessLockOverlay.module.css");

    expect(source).toContain("styles.login");
    expect(source).toContain("styles.patron");
    expect(styles).toContain(".login");
    expect(styles).toContain(".patron");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
