import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("navbar brand typography", () => {
  it("uses the classic desktop brand font consistently across breakpoints", () => {
    const navbar = read("app/components/Navbar.tsx");
    const brand = read("app/components/BrandName.tsx");

    expect(brand).toContain("variant?: 'handwriting' | 'classic'");
    expect(brand).toContain("font-brand font-black tracking-[0.12em] uppercase text-[#171717]");
    expect(brand).toContain("baseName.toUpperCase()");
    expect(navbar).toContain('variant="classic"');
    expect(navbar).not.toContain('variant="handwriting"');
  });
});
