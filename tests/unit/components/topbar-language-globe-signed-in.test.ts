import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("language globe in the top bar", () => {
  it("is rendered for signed-in users too and no longer lives in the account panel", () => {
    const navbar = read("app/components/Navbar.tsx");
    const menu = read("app/components/auth/UserMenu.tsx");
    expect(navbar).toMatch(/<NavbarLanguageSwitcher language=\{language\} \/>/);
    expect(navbar).not.toMatch(/isSignedIn \? null : \(\s*<Suspense/);
    expect(menu).not.toContain("LanguageSwitcher");
    expect(menu).not.toContain("useSwitchLanguage");
    // The account window keeps its own language field (same hook, same save path).
    expect(read("app/components/auth/ProfileSection.tsx")).toContain("useSwitchLanguage");
  });
});
