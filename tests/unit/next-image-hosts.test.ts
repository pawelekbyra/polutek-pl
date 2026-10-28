import { afterEach, describe, expect, it, vi } from "vitest";

type RemotePattern = { protocol: string; hostname: string; pathname?: string };

async function loadPatterns(): Promise<RemotePattern[]> {
  vi.resetModules();
  const config = (await import("../../next.config.mjs")).default as { images: { remotePatterns: RemotePattern[] } };
  return config.images.remotePatterns;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next/image remote hosts (SEC-08)", () => {
  it("lets the optimizer fetch only our thumbnail host and legacy avatars, never wildcards or demo hosts", async () => {
    for (const name of ["ALLOWED_THUMBNAIL_HOSTS", "ALLOWED_COMMENT_IMAGE_HOSTS", "NEXT_PUBLIC_R2_PUBLIC_HOST"]) {
      vi.stubEnv(name, "");
    }
    const hosts = (await loadPatterns()).map((p) => p.hostname).sort();
    expect(hosts).toEqual(["img.clerk.com", "thumbs.pawelperfect.com"]);
  });

  it("adds an explicitly configured host, https only", async () => {
    vi.stubEnv("ALLOWED_THUMBNAIL_HOSTS", "cdn.example.com");
    const patterns = await loadPatterns();
    expect(patterns.map((p) => p.hostname)).toContain("cdn.example.com");
    expect(patterns.every((p) => p.protocol === "https" && !p.hostname.includes("*"))).toBe(true);
  });
});
