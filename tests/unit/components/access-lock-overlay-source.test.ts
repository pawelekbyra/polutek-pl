import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("access lock overlay source contract", () => {
  it("keeps LOGIN_REQUIRED on the logged-in branded copy", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "LOGIN_REQUIRED"');
    expect(source).toContain('lineTwo: "Zalogowanych"');
    expect(source).toContain('actionLabel: "Zaloguj się, aby obczaić"');
    expect(source).toContain("SignInButton");
    expect(source).toContain("from-blue-900 via-black to-blue-950");
    expect(source).toContain("text-blue-400");
  });

  it("defines the thumbnailCompact variant in AccessLockOverlay", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    expect(source).toContain('"thumbnailCompact"');
    expect(source).toContain("isCompact = variant === \"thumbnailCompact\"");
  });

  it("defines the thumbnailCompact variant in PremiumWrapper", () => {
    const source = component("app/components/PremiumWrapper.tsx");
    expect(source).toContain('"thumbnailCompact"');
  });

  it("uses thumbnailCompact variant in SidebarPlaylist", () => {
    const source = component("app/components/channel/SidebarPlaylist.tsx");
    expect(source).toContain('variant="thumbnailCompact"');
  });

  it("keeps PATRON_REQUIRED on the patron branded copy", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED"');
    expect(source).toContain('lineTwo: "Patronów"');
    expect(source).toContain('actionLabel: "Wesprzyj, aby obczaić"');
    expect(source).toContain('href="#donations"');
    expect(source).toContain("from-amber-900 via-black to-amber-950");
    expect(source).toContain("text-amber-500");
    expect(source).toContain("blur-2xl");
  });

  it("keeps ChannelVideoCard badges behind access state", () => {
    const source = component("app/components/ChannelVideoCard.tsx");

    expect(source).toContain("{badge && hasAccess && (");
    expect(source).not.toContain("{badge && (");
  });
});
