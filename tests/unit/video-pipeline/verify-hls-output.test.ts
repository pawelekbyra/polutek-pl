import { describe, expect, it } from "vitest";
import { verifyHlsOutput } from "@/lib/modules/video-pipeline/domain/verify-hls-output";

const prefix = "videos/video-1/v/v4/attempts/11111111-1111-4111-8111-111111111111/";

describe("verifyHlsOutput", () => {
  const playlists = new Map([
    [`${prefix}master.m3u8`, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\n720p/index.m3u8\n"],
    [`${prefix}720p/index.m3u8`, "#EXTM3U\n#EXT-X-MAP:URI=\"init.mp4\"\n#EXTINF:4.0,\nseg_00001.m4s\n#EXT-X-ENDLIST\n"],
  ]);
  const baseKeys = [
    `${prefix}master.m3u8`,
    `${prefix}720p/index.m3u8`,
    `${prefix}720p/init.mp4`,
    `${prefix}720p/seg_00001.m4s`,
  ];
  const readText = async (key: string) => playlists.get(key) ?? null;

  it("confirms every nested playlist reference and media object exists", async () => {
    await expect(verifyHlsOutput(prefix, baseKeys, readText)).resolves.toEqual({ complete: true, objectCount: 4, reason: null });
  });

  it("refuses an output whose manifest or referenced segment is missing", async () => {
    const result = await verifyHlsOutput(prefix, baseKeys.filter((key) => !key.endsWith("seg_00001.m4s")), readText);
    expect(result).toMatchObject({ complete: false, reason: expect.stringContaining("referenced object is missing") });
  });

  it("refuses an unsafe relative URI that escapes the attempt prefix", async () => {
    const unsafe = new Map(playlists);
    unsafe.set(`${prefix}master.m3u8`, "#EXTM3U\n../v5/master.m3u8\n");
    const result = await verifyHlsOutput(prefix, [...baseKeys, "videos/video-1/v/v5/master.m3u8"], async (key) => unsafe.get(key) ?? null);
    expect(result).toMatchObject({ complete: false, reason: expect.stringContaining("unsafe reference") });
  });
});
