import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("access lock overlay source contract", () => {
  it("keeps LOGIN_REQUIRED on the logged-in branded copy", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "LOGIN_REQUIRED"');
    expect(source).toContain('lineOne: isPl ? "WEJDŹ" : "STEP"');
    expect(source).toContain('lineTwo: isPl ? "DO ŚRODKA" : "INSIDE"');
    expect(source).toContain('compactLabel: isPl ? "LOGIN" : "SIGN IN"');
    expect(source).toContain('Zaloguj się, żeby bezpiecznie uruchomić odtwarzanie.');
    expect(source).toContain("SignInButton");
    expect(source).toContain("from-[#03182d] via-[#08111f] to-[#030406]");
    expect(source).toContain("text-cyan-200");
  });

  it("keeps PATRON_REQUIRED on the patron branded copy", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED"');
    expect(source).toContain('lineOne: isPl ? "ZA KULISAMI" : "BEHIND"');
    expect(source).toContain('lineTwo: isPl ? "" : "THE SCENES"');
    expect(source).toContain('compactLabel: isPl ? "PATRON" : "PATRON"');
    expect(source).toContain('Odcinek otwiera jednorazowe wsparcie — bez subskrypcji.');
    expect(source).not.toContain('href="#donations"');
    expect(source).toContain("from-[#251000] via-[#130d07] to-[#040404]");
    expect(source).toContain("text-amber-200");
    expect(source).toContain("blur-3xl");
  });

  it("keeps current cinematic icon treatment with explicit badge surfaces", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain("rounded-full");
    expect(source).toContain("bg-white/[0.055]");
    expect(source).toContain("bg-black/28");
    expect(source).toContain("ring-1 backdrop-blur-md");
    expect(source).not.toContain("bg-amber-500/10");
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
