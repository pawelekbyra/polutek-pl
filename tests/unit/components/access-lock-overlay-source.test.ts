import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");


describe("access lock overlay source contract", () => {
  it("keeps LOGIN_REQUIRED on an accessible sign-in lock path", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('LOGIN_REQUIRED');
    expect(source).toContain('openAuthModal("sign-in")');
    expect(source).toContain("<button");
    expect(source).toContain('type="button"');
    expect(source).toContain("Zaloguj się");
  });

  it("keeps PATRON_REQUIRED on the patron branded lock path", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED" && isSignedIn === true');
    expect(source).toContain('href="#donations"');
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("Jednorazowe wsparcie spełniające próg");
  });

  it("uses deterministic, reduced-motion-safe ambient art", () => {
    const source = component("app/components/AccessLockOverlay.tsx");
    const styles = component("app/components/AccessLockOverlay.module.css");

    expect(source).toContain("CONSTELLATION");
    expect(source).toContain("useReducedMotion");
    expect(source).not.toContain("Math.random");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("pointer-events: none");
  });

  it("renders ChannelVideoCard badges regardless of access state", () => {
    const source = component("app/components/ChannelVideoCard.tsx");

    expect(source).toContain("{badge && (");
    expect(source).not.toContain("{badge && hasAccess && (");
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
