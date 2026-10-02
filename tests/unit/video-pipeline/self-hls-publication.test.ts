import { describe, expect, it } from "vitest";
import { VideoPolicy } from "@/lib/modules/video/domain/video.policy";

const base = { title: "T", slug: "t", tier: "PATRON" as const, status: "DRAFT" as const };

describe("publication blockers for own HLS", () => {
  it("is not publishable until the encode worker has activated a route", () => {
    const blockers = VideoPolicy.getPublicationBlockers({ ...base, activePlaybackRoute: null });
    expect(blockers.map((b) => b.code)).toEqual(["VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE"]);
    expect(VideoPolicy.isAssetReadinessBlocker(blockers[0].code)).toBe(true); // auto-publish keeps waiting quietly
  });

  it("accepts a READY SELF_HLS asset for every tier, including PATRON", () => {
    const route = { asset: { provider: "SELF_HLS", processingState: "READY", objectKey: "videos/v/v/v1" } };
    for (const tier of ["PUBLIC", "LOGGED_IN", "PATRON"] as const) {
      expect(VideoPolicy.getPublicationBlockers({ ...base, tier, activePlaybackRoute: route })).toEqual([]);
    }
  });

  it("blocks a SELF_HLS asset that is not READY or has no object key", () => {
    const notReady = VideoPolicy.getPublicationBlockers({ ...base, activePlaybackRoute: { asset: { provider: "SELF_HLS", processingState: "PROCESSING", objectKey: "k" } } });
    expect(notReady.map((b) => b.code)).toEqual(["VIDEO_PUBLICATION_ASSET_NOT_READY"]);
    const noKey = VideoPolicy.getPublicationBlockers({ ...base, activePlaybackRoute: { asset: { provider: "SELF_HLS", processingState: "READY", objectKey: "" } } });
    expect(noKey.map((b) => b.code)).toEqual(["VIDEO_PUBLICATION_MISSING_PROVIDER_ASSET_ID"]);
  });
});
