/** K24 verifies that an upheld appeal cannot reverse a later decision after an ABA state sequence. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";

vi.mock("@/lib/modules/authz", () => ({ authorize: vi.fn(async () => null) }));
vi.mock("@/lib/modules/channel/infrastructure/moderation-notice", () => ({
  notifyChannelOwnerOfDecision: vi.fn(async () => undefined),
  notifyReporterOfDecision: vi.fn(async () => undefined),
}));

import { resolveModerationAppeal } from "@/lib/modules/channel/application/moderation-appeals.use-cases";
import { setChannelStatus, setVideoModerationStatus } from "@/lib/modules/channel/application/channel-moderation.use-cases";

const prisma = new PrismaClient();
const RUN = `k24-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
let videoId = "";
const appealIds: string[] = [];
let tick = Date.now();
const ctx = () => createAppContext({ actor: { type: "user", userId }, prisma, now: () => new Date(++tick) });

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K24 test" } });
  creatorId = creator.id;
  const video = await prisma.video.create({
    data: { creatorId, title: "K24 ABA test", slug: `${RUN}-video`, thumbnailUrl: "/logo.png" },
  });
  videoId = video.id;
});

afterAll(async () => {
  await prisma.moderationAppeal.deleteMany({ where: { userId } });
  // AuditLog and ModerationDecision are append-only by design. The disposable database is removed after the suite.
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function createAppeal(decisionId: string) {
  const appeal = await prisma.moderationAppeal.create({
    data: { decisionId, userId, channelId: creatorId, text: "Odwołanie testowe K24" },
  });
  appealIds.push(appeal.id);
  return appeal.id;
}

describe("K24 appeal decision identity (PostgreSQL)", () => {
  it("does not reverse channel SUSPENDED→ACTIVE→SUSPENDED for an appeal of the first decision", async () => {
    await setChannelStatus(ctx(), { channelId: creatorId, status: "SUSPENDED", reason: "decyzja A suspend" });
    const decisionA = await prisma.moderationDecision.findFirstOrThrow({ where: { targetId: creatorId, action: "CHANNEL_SUSPENDED" }, orderBy: { createdAt: "desc" } });
    const appealId = await createAppeal(decisionA.id);
    await setChannelStatus(ctx(), { channelId: creatorId, status: "ACTIVE", reason: "decyzja B active" });
    await setChannelStatus(ctx(), { channelId: creatorId, status: "SUSPENDED", reason: "decyzja C suspend" });
    const decisionC = await prisma.moderationDecision.findFirstOrThrow({ where: { targetId: creatorId, action: "CHANNEL_SUSPENDED", id: { not: decisionA.id } }, orderBy: { createdAt: "desc" } });

    const result = await resolveModerationAppeal(ctx(), { appealId, outcome: "UPHELD", reasonPublic: "Stara decyzja nie może cofnąć nowszej." });
    expect(result).toMatchObject({ ok: true, data: { reverted: false } });
    expect(await prisma.creator.findUniqueOrThrow({ where: { id: creatorId } })).toMatchObject({ status: "SUSPENDED", statusDecisionId: decisionC.id });

    const currentAppealId = await createAppeal(decisionC.id);
    const currentResults = await Promise.all([1, 2].map(() => resolveModerationAppeal(ctx(), { appealId: currentAppealId, outcome: "UPHELD", reasonPublic: "Bieżąca decyzja może zostać cofnięta." })));
    const currentSuccesses = currentResults.filter((result) => result.ok);
    expect(currentSuccesses).toHaveLength(1);
    expect(currentSuccesses[0]).toMatchObject({ data: { reverted: true } });
    expect(await prisma.creator.findUniqueOrThrow({ where: { id: creatorId } })).toMatchObject({ status: "ACTIVE", statusDecisionId: null });
  });

  it("does not reverse VIDEO_REMOVED→VISIBLE→VIDEO_REMOVED for an appeal of the first decision", async () => {
    await setVideoModerationStatus(ctx(), { videoId, status: "REMOVED", reason: "decyzja A video remove" });
    const decisionA = await prisma.moderationDecision.findFirstOrThrow({ where: { targetId: videoId, action: "VIDEO_REMOVED" }, orderBy: { createdAt: "desc" } });
    const appealId = await createAppeal(decisionA.id);
    await setVideoModerationStatus(ctx(), { videoId, status: "VISIBLE", reason: "decyzja B video visible" });
    await setVideoModerationStatus(ctx(), { videoId, status: "REMOVED", reason: "decyzja C video remove" });
    const decisionC = await prisma.moderationDecision.findFirstOrThrow({ where: { targetId: videoId, action: "VIDEO_REMOVED", id: { not: decisionA.id } }, orderBy: { createdAt: "desc" } });

    const result = await resolveModerationAppeal(ctx(), { appealId, outcome: "UPHELD", reasonPublic: "Stara decyzja nie może cofnąć nowszej." });
    expect(result).toMatchObject({ ok: true, data: { reverted: false } });
    expect(await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).toMatchObject({ moderationStatus: "REMOVED", moderationDecisionId: decisionC.id });

    const currentAppealId = await createAppeal(decisionC.id);
    const currentResults = await Promise.all([1, 2].map(() => resolveModerationAppeal(ctx(), { appealId: currentAppealId, outcome: "UPHELD", reasonPublic: "Bieżąca decyzja może zostać cofnięta." })));
    const currentSuccesses = currentResults.filter((result) => result.ok);
    expect(currentSuccesses).toHaveLength(1);
    expect(currentSuccesses[0]).toMatchObject({ data: { reverted: true } });
    expect(await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).toMatchObject({ moderationStatus: "VISIBLE", moderationDecisionId: null });
  });
});
