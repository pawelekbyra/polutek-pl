import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import {
  getChannelForStaff,
  listChannelsForStaff,
  resolveContentReport,
  setChannelStatus,
  setChannelTrustLevel,
  setVideoModerationStatus,
} from "@/lib/modules/channel";

function makePrisma(over: Record<string, unknown> = {}) {
  const tx = {
    creator: { updateMany: vi.fn(async () => ({ count: 1 })) },
    moderationDecision: { create: vi.fn(async () => ({ id: "dec1" })) },
    auditLog: { create: vi.fn(async () => ({})) },
    contentReport: { updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn(async () => ({})) },
    video: { update: vi.fn(async () => ({})), findUnique: vi.fn(async () => ({ moderationStatus: "VISIBLE", title: "Film" })) },
    channelQuota: { upsert: vi.fn(async () => ({})) },
  };
  const prisma = {
    // No main channel configured by default (the main_channel_id setting); the "c1" row is an ordinary channel.
    appSetting: { findUnique: vi.fn(async () => null) },
    creator: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string } }) => (where.id === "c1" ? { id: "c1", status: "ACTIVE", quota: null } : null)),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    contentReport: { findUnique: vi.fn(async () => ({ id: "r1", status: "PENDING", targetType: "VIDEO", targetId: "v1", channelId: "c1", reason: "SPAM" })), groupBy: vi.fn(async () => []) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    ...over,
  };
  return { prisma, tx };
}

const staff = { type: "admin" as const, userId: "admin1" };
const user = { type: "user" as const, userId: "u1" };

function ctxFor(actor: typeof staff | typeof user, prisma: unknown) {
  return createAppContext({ actor, prisma: prisma as never });
}

describe("channel moderation use cases", () => {
  it("refuses every operation to a plain user", async () => {
    const { prisma } = makePrisma();
    const ctx = ctxFor(user, prisma);
    expect((await listChannelsForStaff(ctx, { page: 1, pageSize: 10 })).ok).toBe(false);
    expect((await getChannelForStaff(ctx, "c1")).ok).toBe(false);
    expect((await setChannelStatus(ctx, { channelId: "c1", status: "LIMITED", reason: "powod testowy" })).ok).toBe(false);
    expect((await setChannelTrustLevel(ctx, { channelId: "c1", trustLevel: 1 })).ok).toBe(false);
    expect((await resolveContentReport(ctx, { reportId: "r1", outcome: "DISMISSED", reasonPublic: "ok ok" })).ok).toBe(false);
  });

  it("requires a reason to change a status", async () => {
    const { prisma } = makePrisma();
    const res = await setChannelStatus(ctxFor(staff, prisma), { channelId: "c1", status: "SUSPENDED", reason: "no" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as { code?: string }).code).toBe("REASON_REQUIRED");
  });

  it("protects the main channel (the main_channel_id setting) from suspension and ban", async () => {
    const { prisma } = makePrisma({ appSetting: { findUnique: vi.fn(async () => ({ value: "c1" })) } });
    const res = await setChannelStatus(ctxFor(staff, prisma), { channelId: "c1", status: "BANNED", reason: "powod testowy" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as { code?: string }).code).toBe("PRIMARY_PROTECTED");
  });

  it("changes the status with a decision row and an audit row, without writing the legacy isApproved flag", async () => {
    const { prisma, tx } = makePrisma();
    const res = await setChannelStatus(ctxFor(staff, prisma), { channelId: "c1", status: "SUSPENDED", reason: "naruszenie zasad" });
    expect(res.ok).toBe(true);
    const update = tx.creator.updateMany.mock.calls[0][0] as { where: { status: string }; data: Record<string, unknown> };
    expect(update.where.status).toBe("ACTIVE");
    expect(update.data).toMatchObject({ status: "SUSPENDED" });
    expect(update.data).not.toHaveProperty("isApproved");
    expect(tx.moderationDecision.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("reports a lost race instead of overwriting", async () => {
    const { prisma, tx } = makePrisma();
    tx.creator.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await setChannelStatus(ctxFor(staff, prisma), { channelId: "c1", status: "LIMITED", reason: "powod testowy" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as { code?: string }).code).toBe("STATUS_CONFLICT");
  });

  it("resolves a pending report once and can remove the reported video", async () => {
    const { prisma, tx } = makePrisma();
    const res = await resolveContentReport(ctxFor(staff, prisma), { reportId: "r1", outcome: "ACTION_TAKEN", reasonPublic: "Usunięto film", removeVideo: true });
    expect(res.ok).toBe(true);
    expect(tx.video.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { moderationStatus: "REMOVED" } });
    expect(tx.moderationDecision.create).toHaveBeenCalledTimes(1);
  });

  it("does not resolve an already resolved report", async () => {
    const { prisma } = makePrisma({ contentReport: { findUnique: vi.fn(async () => ({ id: "r1", status: "DISMISSED" })) } });
    const res = await resolveContentReport(ctxFor(staff, prisma), { reportId: "r1", outcome: "DISMISSED", reasonPublic: "juz zalatwione" });
    expect(res.ok).toBe(false);
  });

  it("rejects an out of range trust level", async () => {
    const { prisma } = makePrisma();
    const res = await setChannelTrustLevel(ctxFor(staff, prisma), { channelId: "c1", trustLevel: 7 });
    expect(res.ok).toBe(false);
  });

  it("moderates a single video with a decision and an audit row, and only for staff", async () => {
    const { prisma, tx } = makePrisma({ video: { findUnique: vi.fn(async () => ({ id: "v1", creatorId: "c1", moderationStatus: "VISIBLE" })) } });
    (tx as Record<string, unknown>).video = { update: vi.fn(async () => ({})) };
    const denied = await setVideoModerationStatus(ctxFor(user, prisma), { videoId: "v1", status: "REMOVED", reason: "naruszenie zasad" });
    expect(denied.ok).toBe(false);
    const res = await setVideoModerationStatus(ctxFor(staff, prisma), { videoId: "v1", status: "REMOVED", reason: "naruszenie zasad" });
    expect(res.ok).toBe(true);
    expect((tx as unknown as { video: { update: ReturnType<typeof vi.fn> } }).video.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { moderationStatus: "REMOVED" } });
    expect(tx.moderationDecision.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
