import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("access lock overlay source contract", () => {
  it("renders the logged-in branded copy for LOGIN_REQUIRED", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED"');
    expect(source).toContain('"Zalogowanych"');
    expect(source).toContain("SignInButton");
  });

  it("renders the patron branded copy for PATRON_REQUIRED", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('"Patronów"');
    expect(source).toContain('href="#donations"');
    expect(source).toContain("Gem");
  });

  it("keeps ChannelVideoCard badges behind access state", () => {
    const source = component("app/components/ChannelVideoCard.tsx");

    expect(source).toContain("{badge && hasAccess && (");
    expect(source).not.toContain("{badge && (");
  });
});
