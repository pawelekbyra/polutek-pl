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

  it("keeps PATRON_REQUIRED on the patron branded copy", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED"');
    expect(source).toContain('lineTwo: "Patronów"');
    expect(source).toContain('actionLabel: "Wesprzyj, aby obczaić"');
    expect(source).toContain('href="#donations"');
    expect(source).toContain("from-amber-900 via-black to-amber-950");
    expect(source).toContain("text-amber-500");
    expect(source).toContain("blur-md");
    expect(source).not.toContain("blur-2xl");
  });

  it("keeps PR1063 icon treatment without badge wrappers", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).not.toContain("rounded-full");
    expect(source).not.toContain("bg-white/5");
    expect(source).not.toContain("bg-amber-500/10");
    expect(source).not.toContain("border-white/10");
    expect(source).not.toContain("border-amber-500/20");
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
    expect(sidebarSource).toContain('variant="thumbnailCompact"');
  });
});
