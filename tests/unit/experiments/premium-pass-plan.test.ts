// experiment: premium-pass (docs/experiments/premium-pass.md, section 6.2): a PASS_REQUIRED plan is a denied plan
// like any other (no source, token, session, chapters or subtitles) and carries only the offer.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackService } from "@/lib/modules/playback";
import { toPublicPlaybackPlan } from "@/lib/modules/playback/application/public-playback-plan";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { checkVideoAccess } from "@/lib/modules/access";
import type { Actor } from "@/lib/modules/shared/actor";
import { getSafePlaybackState, BLOCKED_PLAYBACK_STATES } from "@/app/components/playback-plan-state";

vi.mock("@/lib/modules/access", () => ({ checkVideoAccess: vi.fn() }));

describe("PASS_REQUIRED playback plan", () => {
  const prisma = {
    video: { findUnique: vi.fn(), findMany: vi.fn() },
    videoPlaybackSession: { create: vi.fn() },
    appSetting: { findUnique: vi.fn() },
  };

  const row = {
    id: "video-jj",
    slug: "jj",
    title: "Zbieram hajs",
    thumbnailUrl: "/thumb.jpg",
    tier: "LOGGED_IN",
    status: "PUBLISHED",
    isMainFeatured: false,
    publishedAt: new Date(Date.now() - 86_400_000),
    premiereAt: null,
    subtitleUrlPl: "https://subs.example/pl.vtt",
    chapters: [{ startSeconds: 0, title: "Start" }, { startSeconds: 15, title: "Środek" }, { startSeconds: 30, title: "Koniec" }],
    activePlaybackRoute: null,
    assets: [{ id: "asset-1", provider: "SELF_HLS", objectKey: "videos/video-jj/v/v1", processingState: "READY", isPrimary: true, createdAt: new Date(), updatedAt: new Date() }],
  };

  const plan = (actor: Actor) => PlaybackService.createPlaybackPlanWithContext("video-jj", createAppContext({ actor, prisma: prisma as never }));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HLS_TOKEN_SECRET = "s".repeat(40);
    process.env.PREMIUM_PASS_EXPERIMENT = "all";
    prisma.video.findUnique.mockResolvedValue(row);
    prisma.video.findMany.mockResolvedValue([row, { ...row, id: "video-tt", slug: "test-transkodowania" }]);
    prisma.videoPlaybackSession.create.mockResolvedValue({ id: "session-1" });
    prisma.appSetting.findUnique.mockResolvedValue(null);
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: "PASS_REQUIRED", videoId: "video-jj" } } as never);
  });

  afterEach(() => {
    delete process.env.HLS_TOKEN_SECRET;
    delete process.env.PREMIUM_PASS_EXPERIMENT;
  });

  for (const actor of [{ type: "guest" }, { type: "user", userId: "u1" }, { type: "admin", userId: "a1" }] as Actor[]) {
    it(`${actor.type}: nothing playable, only the offer`, async () => {
      const result = toPublicPlaybackPlan(await plan(actor));
      expect(result.status).toBe("PASS_REQUIRED");
      expect(result.canPlay).toBe(false);
      expect(result.access.allowed).toBe(false);
      expect(result.source).toBeUndefined();
      expect(result.playbackUrl).toBeUndefined();
      expect(result.tracking.playbackSessionId).toBe("");
      expect(result.player.chapters).toBeUndefined();
      expect(result.player.textTracks).toBeUndefined();
      const json = JSON.stringify(result);
      expect(json).not.toContain("videos/video-jj/v/v1");
      expect(json).not.toContain("subs.example");
      expect(json).not.toContain("Środek");
      expect(prisma.videoPlaybackSession.create).not.toHaveBeenCalled();
      expect(result.access.offer).toMatchObject({
        currency: "PLN", premiumCount: 2, signedIn: actor.type !== "guest", defaultProductId: "ACCESS_LIFETIME", payments: { mode: "demo" },
      });
      expect(result.access.offer?.products.map((p) => [p.id, p.priceMinor, p.days])).toEqual([["ACCESS_30D", 1499, 30], ["ACCESS_LIFETIME", 2999, null]]);
    });
  }

  it("is a blocked state for the browser (the player is never mounted)", () => {
    expect(BLOCKED_PLAYBACK_STATES.has("PASS_REQUIRED")).toBe(true);
    expect(getSafePlaybackState({ status: "PASS_REQUIRED" })).toBe("PASS_REQUIRED");
  });

  it("an expired pass shows on the offer (viewer's own pass only)", async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        v: 1, product: "PASS_7D", provider: "DEMO", ref: "DEMO-AAAA-BBBB", priceMinor: 1499, currency: "PLN", method: "card",
        requestId: "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d", grantedAt: "2026-01-01T10:00:00.000Z", expiresAt: "2026-01-08T10:00:00.000Z",
        consents: { termsVersion: "demo-2026-10", waiverAt: "2026-01-01T10:00:00.000Z" },
      }),
    });
    const result = await plan({ type: "user", userId: "u1" });
    expect(result.access.offer?.expiredAt).toBe("2026-01-08T10:00:00.000Z");
    expect(JSON.stringify(result)).not.toContain("8b1f9f3e");
  });

  it("with an active pass the plan plays and says until when", async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: true, videoId: "video-jj", premiumPassUntil: "2026-11-20T10:00:00.000Z" } } as never);
    const result = await plan({ type: "user", userId: "u1" });
    expect(result.status).toBe("READY");
    expect(result.canPlay).toBe(true);
    expect(result.access.premiumPassUntil).toBe("2026-11-20T10:00:00.000Z");
    expect(result.access.offer).toBeUndefined();
  });

  it("other denials never carry an offer", async () => {
    vi.mocked(checkVideoAccess).mockResolvedValue({ ok: true, data: { hasAccess: false, reason: "LOGIN_REQUIRED", videoId: "video-jj" } } as never);
    const result = await plan({ type: "guest" });
    expect(result.status).toBe("LOGIN_REQUIRED");
    expect(result.access.offer).toBeUndefined();
  });
});
