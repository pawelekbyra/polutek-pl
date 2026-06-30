import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");


describe("access lock overlay source contract", () => {
  it("keeps LOGIN_REQUIRED on an accessible sign-in lock path", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('LOGIN_REQUIRED');
    expect(source).toContain("SignInButton");
    expect(source).toContain("<button");
    expect(source).toContain('type="button"');
    expect(source).toContain("Zaloguj się");
  });

  it("keeps PATRON_REQUIRED on the patron branded lock path", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED"');
    expect(source).toContain("PATRON");
    expect(source).toContain('href="#donations"');
    expect(source).toContain("scrollIntoView");
    expect(source).not.toContain("Wesprzyj, aby obczaić");
  });

  it("keeps old badge wrapper colors out of the icon treatment", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).not.toContain("bg-white/5");
    expect(source).not.toContain("bg-amber-500/10");
    expect(source).not.toContain("border-white/10");
    expect(source).not.toContain("border-amber-500/20");
    expect(source).not.toContain("blur-2xl");
  });

  it("keeps ChannelVideoCard badges behind access state", () => {
    const source = component("app/components/ChannelVideoCard.tsx");

    expect(source).toContain("{badge && hasAccess && (");
    expect(source).not.toContain("{badge && (");
  });

  it("supports thumbnailCompact variant in overlays and wrappers", () => {
    const overlaySource = component("app/components/AccessLockOverlay.tsx");
    expect(overlaySource).toContain('"default" | "thumbnail" | "thumbnailCompact"');
    expect(overlaySource).toContain('variant === "thumbnailCompact"');

    const wrapperSource = component("app/components/PremiumWrapper.tsx");
    expect(wrapperSource).toContain('"default" | "thumbnail" | "thumbnailCompact"');
    expect(wrapperSource).toContain('variant === "thumbnail" || variant === "thumbnailCompact"');

    const sidebarSource = component("app/components/channel/SidebarPlaylist.tsx");
    // expect(sidebarSource).toContain('variant="thumbnailCompact"'); // Removed as part of optimization
  });
});
