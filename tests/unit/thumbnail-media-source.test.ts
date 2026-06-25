import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("thumbnail media-source fan-out guard", () => {
  it("does not leak full media-source fetch logic to list thumbnails unnecessarily", () => {
    const channelCard = readFileSync(
      "app/components/ChannelVideoCard.tsx",
      "utf8",
    );
    const channelHome = readFileSync("app/components/ChannelHome.tsx", "utf8");

    // Channel cards must use safe thumbnail/access summary data only.
    expect(channelCard).not.toContain("PremiumWrapper");

    // But we check that it doesn't contain direct fetch calls to media-source
    expect(channelCard).not.toContain("/api/media-source");
    expect(channelHome).not.toContain("/api/media-source");
  });
});
