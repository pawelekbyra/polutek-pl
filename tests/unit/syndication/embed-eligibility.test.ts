import { describe, expect, it } from "vitest";
import { decideEmbed, type EmbedCandidate } from "@/lib/modules/syndication/domain/embed-eligibility";
import { isOembedDiscoverable } from "@/lib/embed/discovery";

const NOW = new Date("2026-10-15T12:00:00Z");
const base: EmbedCandidate = {
  status: "PUBLISHED",
  tier: "PUBLIC",
  moderationStatus: "VISIBLE",
  isAdult: false,
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  premiereAt: null,
  creator: { status: "ACTIVE", deletedAt: null },
};

describe("decideEmbed: only PUBLIC-tier published videos may be embedded", () => {
  it("embeds a published PUBLIC video on a visible channel (ACTIVE or LIMITED)", () => {
    expect(decideEmbed(base, NOW)).toBe("embeddable");
    expect(decideEmbed({ ...base, creator: { status: "LIMITED", deletedAt: null } }, NOW)).toBe("embeddable");
  });

  it("embeds a premiere that has aired and a video with no publication date", () => {
    expect(decideEmbed({ ...base, premiereAt: new Date("2026-10-14T00:00:00Z") }, NOW)).toBe("embeddable");
    expect(decideEmbed({ ...base, publishedAt: null }, NOW)).toBe("embeddable");
  });

  it.each(["LOGGED_IN", "PAID", "PATRON", null, undefined, "SOMETHING_NEW"])("sends tier %s to the site (never plays it in a frame)", (tier) => {
    expect(decideEmbed({ ...base, tier }, NOW)).toBe("site-only");
  });

  it("sends 18+ (declared or by moderation) and a premiere still to come to the site", () => {
    expect(decideEmbed({ ...base, isAdult: true }, NOW)).toBe("site-only");
    expect(decideEmbed({ ...base, moderationStatus: "AGE_RESTRICTED" }, NOW)).toBe("site-only");
    expect(decideEmbed({ ...base, premiereAt: new Date("2026-10-16T00:00:00Z") }, NOW)).toBe("site-only");
  });

  it.each([
    ["missing", null],
    ["UNLISTED (link only)", { ...base, status: "UNLISTED" }],
    ["DRAFT", { ...base, status: "DRAFT" }],
    ["ARCHIVED", { ...base, status: "ARCHIVED" }],
    ["removed", { ...base, moderationStatus: "REMOVED" }],
    ["not yet published", { ...base, publishedAt: new Date("2026-10-20T00:00:00Z") }],
    ["on a suspended channel", { ...base, creator: { status: "SUSPENDED", deletedAt: null } }],
    ["on a banned channel", { ...base, creator: { status: "BANNED", deletedAt: null } }],
    ["on a pending channel", { ...base, creator: { status: "PENDING_REVIEW", deletedAt: null } }],
    ["on a deleted channel", { ...base, creator: { status: "ACTIVE", deletedAt: new Date("2026-10-01T00:00:00Z") } }],
    ["without a channel", { ...base, creator: null }],
  ])("treats a video that is %s as unavailable (no hint that it exists)", (_label, video) => {
    expect(decideEmbed(video as EmbedCandidate | null, NOW)).toBe("unavailable");
  });
});

describe("isOembedDiscoverable (head link hint on the public page)", () => {
  it("advertises only a PUBLIC, published, non-adult video that is not an upcoming premiere", () => {
    expect(isOembedDiscoverable({ tier: "PUBLIC", status: "PUBLISHED", isAdult: false, premiereAt: null })).toBe(true);
    expect(isOembedDiscoverable({ tier: "LOGGED_IN", status: "PUBLISHED" })).toBe(false);
    expect(isOembedDiscoverable({ tier: "PUBLIC", status: "UNLISTED" })).toBe(false);
    expect(isOembedDiscoverable({ tier: "PUBLIC", status: "PUBLISHED", isAdult: true })).toBe(false);
    expect(isOembedDiscoverable({ tier: "PUBLIC", status: "PUBLISHED", premiereAt: new Date(Date.now() + 3_600_000) })).toBe(false);
  });
});
