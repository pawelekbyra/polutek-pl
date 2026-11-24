import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetStudioDraft, rememberedStudioDraft, rememberStudioDraft, studioFileIdentity } from "@/lib/video-upload/studio-resume";

afterEach(() => vi.unstubAllGlobals());

describe("Studio upload resume identity", () => {
  it("distinguishes files with the same name, size and timestamp but different sampled content", async () => {
    const bytesA = new Uint8Array(256 * 1024).fill(7);
    const bytesB = bytesA.slice();
    bytesB[128 * 1024] = 9;
    const a = new File([bytesA], "same.mp4", { lastModified: 42 });
    const b = new File([bytesB], "same.mp4", { lastModified: 42 });
    expect(await studioFileIdentity(a)).not.toBe(await studioFileIdentity(b));
  });

  it("remembers and clears the associated draft across a page reload", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
    vi.stubGlobal("localStorage", storage);
    const file = new File(["resume me"], "video.mp4", { lastModified: 43 });
    await rememberStudioDraft(file, "video-123");
    expect(await rememberedStudioDraft(file)).toBe("video-123");
    await forgetStudioDraft(file);
    expect(await rememberedStudioDraft(file)).toBeNull();
  });
});
