import { describe, it, expect } from "vitest";
import { MediaPolicy } from "@/lib/modules/media/domain/media.policy";

const OWN = "https://video.pawelperfect.com/h/1790000000.abcDEF123/c52f0407-b0e8-4b5c-b6d3-a9f152653002/v1/master.m3u8";

describe("MediaPolicy.isProbablyRawMediaUrl and own HLS delivery", () => {
  it("does not treat our signed delivery URL as a raw storage URL (it must reach the player unredacted)", () => {
    expect(MediaPolicy.isSelfHlsDeliveryUrl(OWN, {} as NodeJS.ProcessEnv)).toBe(true);
    expect(MediaPolicy.isProbablyRawMediaUrl(OWN)).toBe(false);
  });

  it("follows HLS_DELIVERY_BASE_URL", () => {
    const env = { HLS_DELIVERY_BASE_URL: "https://hls.example.org/" } as unknown as NodeJS.ProcessEnv;
    expect(MediaPolicy.isSelfHlsDeliveryUrl("https://hls.example.org/h/t/v/v1/master.m3u8", env)).toBe(true);
    expect(MediaPolicy.isSelfHlsDeliveryUrl(OWN, env)).toBe(false);
  });

  it("still redacts look-alikes and other raw media URLs", () => {
    expect(MediaPolicy.isProbablyRawMediaUrl("https://evil.example.com/h/t/v/v1/master.m3u8")).toBe(true);
    expect(MediaPolicy.isProbablyRawMediaUrl("https://video.pawelperfect.com.evil.com/h/t/v/v1/master.m3u8")).toBe(true);
    expect(MediaPolicy.isProbablyRawMediaUrl("http://video.pawelperfect.com/h/t/v/v1/master.m3u8")).toBe(true);
    expect(MediaPolicy.isProbablyRawMediaUrl("https://video.pawelperfect.com/raw/movie.mp4")).toBe(true);
    expect(MediaPolicy.isProbablyRawMediaUrl("https://video.pawelperfect.com/h/t/v/v1/other.m3u8")).toBe(true);
  });
});
