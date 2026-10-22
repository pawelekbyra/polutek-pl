import { describe, expect, it } from "vitest";
import { qualityBadge } from "@/app/components/player/quality-label";

describe("qualityBadge", () => {
  it("names the rendition by its height", () => {
    expect(qualityBadge(2160)).toBe("4K");
    expect(qualityBadge(4320)).toBe("4K");
    expect(qualityBadge(1440)).toBe("HD");
    expect(qualityBadge(1080)).toBe("HD");
    expect(qualityBadge(720)).toBe("HD");
    expect(qualityBadge(480)).toBe("SD");
    expect(qualityBadge(240)).toBe("SD");
  });

  it("is null while the height is unknown", () => {
    expect(qualityBadge(undefined)).toBeNull();
    expect(qualityBadge(null)).toBeNull();
    expect(qualityBadge(0)).toBeNull();
    expect(qualityBadge(Number.NaN)).toBeNull();
  });
});
