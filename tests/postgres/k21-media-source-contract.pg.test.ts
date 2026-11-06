/** K21 playback response contract through the real route and PostgreSQL-backed PlaybackService. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PlaybackPlanResponseSchema } from "@/lib/video-api-contracts/contracts";

vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn(async () => ({ type: "guest" })) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/observability", () => ({ recordAlert: vi.fn() }));
vi.mock("@/lib/logger", () => ({ createScopedLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) }));

import { GET as mediaSourceGet } from "@/app/api/media-source/[videoId]/route";

const prisma = new PrismaClient();
const RUN = `k21-playback-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
let videoId = "";

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K21 playback contract" } });
  creatorId = creator.id;
  const video = await prisma.video.create({
    data: {
      creatorId,
      title: "Contract playback fixture",
      slug: `${RUN}-video`,
      thumbnailUrl: "/thumb.jpg",
      tier: "LOGGED_IN",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  videoId = video.id;
});

afterAll(async () => {
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("K21 media-source route contract (PostgreSQL)", () => {
  it("returns a valid denied playback plan from the real database-backed service", async () => {
    const request = new NextRequest(`https://www.pawelperfect.com/api/media-source/${videoId}`, {
      headers: { "user-agent": "k21-contract-test" },
    });
    const response = await mediaSourceGet(request, { params: Promise.resolve({ videoId }) });
    expect(response.status).toBe(403);
    const body: unknown = await response.json();
    expect(PlaybackPlanResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ status: "LOGIN_REQUIRED", canPlay: false, hasAccess: false });
  });
});
