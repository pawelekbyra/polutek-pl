import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("accessibility audit fixes (static)", () => {
  it("A09: the search trigger and the desktop search field switch at the same breakpoint (no gap at 640-767px)", () => {
    const navbar = read("app/components/Navbar.tsx");
    expect(navbar).toContain("hidden md:flex mx-2 min-w-0"); // desktop field from md
    expect(navbar).toContain("flex items-center md:hidden -mr-[5px]"); // mobile trigger until md
    expect(navbar).not.toContain("sm:hidden -mr-[5px]");
  });

  it("A07: changing the profile photo is a real button that opens the hidden file input", () => {
    const profile = read("app/components/auth/ProfileSection.tsx");
    expect(profile).toContain("avatarInputRef.current?.click()");
    expect(profile).toMatch(/<button[^>]*\n?\s*type="button"[\s\S]{0,200}avatarInputRef\.current\?\.click\(\)/);
    expect(profile).not.toMatch(/<label[^>]*>[\s\S]{0,200}type="file"/);
  });
});
