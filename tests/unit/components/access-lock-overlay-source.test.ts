import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("access lock overlay source contract", () => {
  it("keeps LOGIN_REQUIRED on the logged-in branded copy with blue styling", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "LOGIN_REQUIRED"');
    expect(source).toContain('lineTwo: "Zalogowanych"');
    expect(source).toContain('actionLabel: "Zaloguj się, aby obczaić"');
    expect(source).toContain("SignInButton");
    expect(source).toContain('gradient: "from-blue-900 via-black to-blue-950"');
    expect(source).toContain('accent: "text-blue-400"');
  });

  it("keeps PATRON_REQUIRED on the patron branded copy with amber styling and blur", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('state === "PATRON_REQUIRED"');
    expect(source).toContain('lineTwo: "Patronów"');
    expect(source).toContain('actionLabel: "Wesprzyj, aby obczaić"');
    expect(source).toContain('href="#donations"');
    expect(source).toContain('gradient: "from-amber-900 via-black to-amber-950"');
    expect(source).toContain('accent: "text-amber-500"');
    expect(source).toContain('blur-2xl');
  });

  it("ensures bounded clamp values for thumbnail sizing", () => {
    const source = component("app/components/AccessLockOverlay.tsx");

    expect(source).toContain('h-[clamp(1.9rem,14cqi,3.15rem)]');
    expect(source).toContain('text-[clamp(0.68rem,5.8cqi,1.15rem)]');
    expect(source).toContain('text-[clamp(0.34rem,2.45cqi,0.56rem)]');
  });

  it("keeps ChannelVideoCard badges behind access state", () => {
    const source = component("app/components/ChannelVideoCard.tsx");

    expect(source).toContain("{badge && hasAccess && (");
    expect(source).not.toContain("{badge && (");
  });
});
