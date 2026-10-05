import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";

const mocks = vi.hoisted(() => ({
  headers: new Headers({ "user-agent": "Mozilla/5.0 Chrome/150" }),
  createPlan: vi.fn(),
  rateLimit: vi.fn(),
  preload: vi.fn(),
  preconnect: vi.fn(),
  listComments: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => mocks.headers }));
vi.mock("react-dom", () => ({ preload: mocks.preload, preconnect: mocks.preconnect }));
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/modules/comments", () => ({ listVideoComments: mocks.listComments }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: (o: unknown) => o }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  createScopedLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/modules/playback", async () => ({
  PlaybackService: { createPlaybackPlanWithContext: mocks.createPlan },
  ...(await import("@/lib/modules/playback/application/public-playback-plan")),
}));

import { loadHeroPlaybackPlan, loadInitialComments, shouldRenderHeroPlan } from "@/app/components/home/home-viewer-data";

const MANIFEST = "https://video.pawelperfect.com/h/1.sig/v1/a/master.m3u8";
const video = (tier: PublicVideoDTO["tier"], premiereAt: string | null = null) =>
  ({ id: "v1", tier, status: "PUBLISHED", premiereAt }) as unknown as PublicVideoDTO;
const guest = { type: "guest" } as const;
const user = { type: "user", userId: "u1" } as const;

const readyPlan = {
  videoId: "v1",
  status: "READY",
  canPlay: true,
  access: { allowed: true },
  source: { provider: "SELF_HLS", kind: "self_hls", playbackUrl: MANIFEST },
  diagnostics: { warnings: [] },
  tracking: { playbackSessionId: "s1", heartbeatIntervalSeconds: 15 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers = new Headers({ "user-agent": "Mozilla/5.0 Chrome/150" });
  mocks.rateLimit.mockResolvedValue({ success: true });
});

describe("hero playback plan in the server render", () => {
  it("is skipped where the browser would not ask either (guest lock, premiere)", () => {
    expect(shouldRenderHeroPlan(video("LOGGED_IN"), guest)).toBe(false);
    expect(shouldRenderHeroPlan(video("PUBLIC", new Date(Date.now() + 60_000).toISOString()), user)).toBe(false);
    expect(shouldRenderHeroPlan(video("PUBLIC"), guest)).toBe(true);
    expect(shouldRenderHeroPlan(video("LOGGED_IN"), user)).toBe(true);
  });

  it("returns the viewer's plan and hints the manifest when it can play", async () => {
    mocks.createPlan.mockResolvedValue(readyPlan);
    const result = await loadHeroPlaybackPlan({ video: video("PUBLIC"), actor: guest, viewerKey: "anonymous" });
    expect(result?.viewerKey).toBe("anonymous");
    expect(result?.plan.source?.playbackUrl).toBe(MANIFEST);
    expect(mocks.preload).toHaveBeenCalledWith(MANIFEST, { as: "fetch", crossOrigin: "anonymous" });
    expect(mocks.preconnect).toHaveBeenCalledWith("https://video.pawelperfect.com", { crossOrigin: "anonymous" });
  });

  it("a plan that cannot play carries no URL, token or session, and no hint is emitted", async () => {
    mocks.createPlan.mockResolvedValue({
      ...readyPlan,
      status: "NO_PRIMARY_ASSET",
      canPlay: false,
    });
    const result = await loadHeroPlaybackPlan({ video: video("PUBLIC"), actor: user, viewerKey: "user:u1:session:s" });
    expect(result?.plan.source).toBeUndefined();
    expect(result?.plan.tracking.playbackSessionId).toBe("");
    expect(JSON.stringify(result)).not.toContain(MANIFEST);
    expect(mocks.preload).not.toHaveBeenCalled();
  });

  it("drops a raw storage URL like the API does", async () => {
    mocks.createPlan.mockResolvedValue({
      ...readyPlan,
      source: { kind: "video", playbackUrl: "https://s3.amazonaws.com/bucket/secret.mp4" },
    });
    const result = await loadHeroPlaybackPlan({ video: video("PUBLIC"), actor: guest, viewerKey: "anonymous" });
    expect(JSON.stringify(result)).not.toContain("amazonaws");
    expect(result?.plan.canPlay).toBe(false);
  });

  it("opens no playback session for crawlers or over the rate limit", async () => {
    mocks.headers = new Headers({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    expect(await loadHeroPlaybackPlan({ video: video("PUBLIC"), actor: guest, viewerKey: "anonymous" })).toBeNull();

    mocks.headers = new Headers({ "user-agent": "Mozilla/5.0 Chrome/150" });
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect(await loadHeroPlaybackPlan({ video: video("PUBLIC"), actor: guest, viewerKey: "anonymous" })).toBeNull();
    expect(mocks.createPlan).not.toHaveBeenCalled();
  });

  it("fails soft (the browser asks itself) when the service throws", async () => {
    mocks.createPlan.mockRejectedValue(new Error("db down"));
    expect(await loadHeroPlaybackPlan({ video: video("PUBLIC"), actor: guest, viewerKey: "anonymous" })).toBeNull();
  });
});

describe("first page of comments in the server render", () => {
  it("is the API's JSON for this video (newest)", async () => {
    mocks.listComments.mockResolvedValue({
      ok: true,
      data: { comments: [{ id: "c1", createdAt: new Date("2026-10-01T10:00:00Z") }], totalCount: 1, nextCursor: null },
    });
    const result = await loadInitialComments("v1", guest);
    expect(mocks.listComments).toHaveBeenCalledWith({ videoId: "v1", sortBy: "newest", limit: 20 }, { actor: guest });
    expect(result).toEqual({
      videoId: "v1",
      sortBy: "newest",
      page: { success: true, comments: [{ id: "c1", createdAt: "2026-10-01T10:00:00.000Z" }], totalCount: 1, nextCursor: null },
    });
  });

  it("is null (the browser loads them) without an actor or on an error", async () => {
    expect(await loadInitialComments("v1", null)).toBeNull();
    mocks.listComments.mockResolvedValue({ ok: false, error: { type: "FORBIDDEN" } });
    expect(await loadInitialComments("v1", guest)).toBeNull();
  });
});
