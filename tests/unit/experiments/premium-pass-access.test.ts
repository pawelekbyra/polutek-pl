// experiment: premium-pass (docs/experiments/premium-pass.md, section 15): the access matrix.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessTier, VideoStatus } from "@prisma/client";
import { checkVideoAccess } from "@/lib/modules/access";
import { createAppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";

const now = new Date("2026-10-21T10:00:00.000Z");
const channel = { id: "chan-1", slug: "main", userId: "owner", status: "ACTIVE", deletedAt: null };

const videos = {
  premium: { id: "v-jj", slug: "jj", tier: AccessTier.LOGGED_IN, isMainFeatured: false, premiereAt: null },
  premiumPublic: { id: "v-tt", slug: "test-transkodowania", tier: AccessTier.PUBLIC, isMainFeatured: false, premiereAt: null },
  regular: { id: "v-hero", slug: "czesc-all-star", tier: AccessTier.PUBLIC, isMainFeatured: true, premiereAt: null },
  premiere: { id: "v-pr", slug: "dla-patronow", tier: AccessTier.PUBLIC, isMainFeatured: false, premiereAt: new Date("2026-12-31T00:00:00.000Z") },
} as const;
type VideoKey = keyof typeof videos;

const actors: Record<string, Actor> = {
  guest: { type: "guest" },
  user: { type: "user", userId: "u-plain" },
  tester: { type: "user", userId: "u-tester" },
  testerWithPass: { type: "user", userId: "u-pass" },
  testerExpired: { type: "user", userId: "u-expired" },
  admin: { type: "admin", userId: "u-admin" },
};

function passRow(userId: string, expiresAt: string) {
  return {
    value: JSON.stringify({
      v: 1, product: "PASS_30D", provider: "DEMO", ref: "DEMO-AAAA-BBBB", priceMinor: 2900, currency: "PLN", method: "blik",
      requestId: "8b1f9f3e-1d2c-4a5b-9c7d-0e1f2a3b4c5d", grantedAt: "2026-10-01T10:00:00.000Z", expiresAt,
      consents: { termsVersion: "demo-2026-10", waiverAt: "2026-10-01T10:00:00.000Z" },
    }),
    userId,
  };
}

const passes: Record<string, { value: string }> = {
  "xp.premium_pass:u-pass": passRow("u-pass", "2026-11-20T10:00:00.000Z"),
  "xp.premium_pass:u-expired": passRow("u-expired", "2026-10-20T10:00:00.000Z"),
};

function prismaFor(video: VideoKey) {
  return {
    video: {
      findFirst: vi.fn().mockResolvedValue({
        ...videos[video],
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date("2026-10-01T00:00:00.000Z"),
        creatorId: channel.id,
        creator: channel,
      }),
    },
    user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, isDeleted: false })) },
    entitlement: { findFirst: vi.fn().mockResolvedValue(null) },
    appSetting: { findUnique: vi.fn(async ({ where }: { where: { key: string } }) => passes[where.key] ?? null) },
  };
}

async function decide(video: VideoKey, actor: Actor) {
  const prisma = prismaFor(video);
  const result = await checkVideoAccess({ videoIdOrSlug: videos[video].slug }, createAppContext({ actor, prisma: prisma as never, now: () => now }));
  if (!result.ok) throw new Error("unexpected failure");
  return { decision: result.data, prisma };
}

const ENV_KEYS = ["PREMIUM_PASS_EXPERIMENT", "PREMIUM_PASS_TESTER_IDS", "PREMIUM_PASS_VIDEO_SLUGS"] as const;
function setMode(mode: "unset" | "off" | "testers" | "all") {
  for (const key of ENV_KEYS) delete process.env[key];
  if (mode === "unset") return;
  process.env.PREMIUM_PASS_EXPERIMENT = mode;
  process.env.PREMIUM_PASS_TESTER_IDS = "u-tester,u-pass,u-expired";
  process.env.PREMIUM_PASS_VIDEO_SLUGS = "jj,test-transkodowania,czesc-all-star,dla-patronow";
}

describe("premium-pass access matrix", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("off gives exactly the decisions of a site without the experiment, and never reads a pass", async () => {
    for (const video of Object.keys(videos) as VideoKey[]) {
      for (const actor of Object.values(actors)) {
        setMode("unset");
        const baseline = await decide(video, actor);
        setMode("off");
        const off = await decide(video, actor);
        expect(off.decision).toEqual(baseline.decision);
        expect(off.prisma.appSetting.findUnique).not.toHaveBeenCalled();
      }
    }
  });

  const visibleIn = (mode: "testers" | "all", name: string) => mode === "all" || ["tester", "testerWithPass", "testerExpired"].includes(name);

  for (const mode of ["testers", "all"] as const) {
    describe(`mode ${mode}`, () => {
      for (const [name, actor] of Object.entries(actors)) {
        it(`${name}: pass videos need an active pass, the rest is unchanged`, async () => {
          for (const video of Object.keys(videos) as VideoKey[]) {
            setMode("unset");
            const baseline = (await decide(video, actor)).decision;
            setMode(mode);
            const { decision } = await decide(video, actor);
            const gated = (video === "premium" || video === "premiumPublic") && visibleIn(mode, name);
            if (!gated) {
              // hero and upcoming premiere are never behind the pass, even when listed
              expect(decision, `${video}`).toEqual(baseline);
            } else if (name === "testerWithPass") {
              expect(decision).toEqual({ ...baseline, premiumPassUntil: "2026-11-20T10:00:00.000Z" });
            } else {
              expect(decision).toMatchObject({ hasAccess: false, reason: "PASS_REQUIRED" });
              expect(decision.premiumPassUntil).toBeUndefined();
            }
          }
        });
      }
    });
  }

  it("ADMIN on the public site sees the paywall too while the experiment is on (owner decision)", async () => {
    setMode("all");
    const { decision } = await decide("premium", actors.admin!);
    expect(decision).toMatchObject({ hasAccess: false, reason: "PASS_REQUIRED" });
  });

  it("a guest gets PASS_REQUIRED (the offer), not LOGIN_REQUIRED, for a signed-in-tier pass video", async () => {
    setMode("all");
    const { decision } = await decide("premium", actors.guest!);
    expect(decision.reason).toBe("PASS_REQUIRED");
  });
});
