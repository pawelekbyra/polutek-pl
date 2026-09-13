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
    expect(source).toContain("Odblokuj dostęp");
  });

  it("uses the shared action and patron tokens", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    const styles = component("app/components/AccessLockOverlay.module.css");
    const globalStyles = component("app/globals.css");

    expect(styles).toContain("var(--chan-blue)");
    expect(styles).toContain("var(--chan-amber)");
    // --chan-amber-strong is not referenced bare here — this file uses the
    // pre-computed --cm-amber-strong-*-black color-mix() tokens instead, which
    // globals.css derives from var(--chan-amber-strong). That's the literal
    // implementation of CLAUDE.md's documented aurora design: "deep --chan-blue
    // for login, deep --chan-amber/--chan-amber-strong for patron, all mixed
    // into --chan-ink rather than pure black". Confirm both ends of that
    // indirection instead of the bare token that was never used directly.
    expect(styles).toContain("var(--cm-amber-strong-68-black)");
    expect(globalStyles).toContain(
      "--cm-amber-strong-68-black: color-mix(in srgb, var(--chan-amber-strong) 68%, black);",
    );
  });
});
