import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createContentReport } from "@/lib/modules/channel";

const visibleVideo = { id: "v1", creatorId: "c1", status: "PUBLISHED", moderationStatus: "VISIBLE", creator: { status: "ACTIVE", deletedAt: null } };

function make(over: Record<string, unknown> = {}) {
  const prisma = {
    video: { findUnique: vi.fn(async () => visibleVideo) },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn(async () => ({ id: "c1", status: "ACTIVE", deletedAt: null })) },
    contentReport: {
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(async () => ({ id: "r1" })),
    },
    ...over,
  };
  const ctx = (actor: unknown) => createAppContext({ actor: actor as never, prisma: prisma as never });
  return { prisma, ctx };
}
const user = { type: "user", userId: "u1" };

describe("createContentReport", () => {
  it("needs a signed-in user", async () => {
    const { ctx } = make();
    expect((await createContentReport(ctx({ type: "guest" }), { targetType: "VIDEO", targetId: "v1", reason: "SPAM" })).ok).toBe(false);
    expect((await createContentReport(ctx({ type: "admin", userId: "a" }), { targetType: "VIDEO", targetId: "v1", reason: "SPAM" })).ok).toBe(false);
  });

  it("stores a report with the video's channel", async () => {
    const { ctx, prisma } = make();
    const res = await createContentReport(ctx(user), { targetType: "VIDEO", targetId: "v1", reason: "SPAM", note: "  reklama  " });
    expect(res).toEqual({ ok: true, data: { id: "r1" } });
    expect(prisma.contentReport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channelId: "c1", reporterId: "u1", note: "reklama" }) }));
  });

  it("does not confirm hidden content exists", async () => {
    const hidden = make({ video: { findUnique: vi.fn(async () => ({ ...visibleVideo, moderationStatus: "REMOVED" })) } });
    const res = await createContentReport(hidden.ctx(user), { targetType: "VIDEO", targetId: "v1", reason: "SPAM" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as { code?: string }).code).toBe("NOT_FOUND");
    const gone = make({ creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn(async () => ({ id: "c1", status: "SUSPENDED", deletedAt: null })) } });
    expect((await createContentReport(gone.ctx(user), { targetType: "CHANNEL", targetId: "c1", reason: "SPAM" })).ok).toBe(false);
  });

  it("refuses a duplicate open report and enforces the daily cap", async () => {
    const dup = make({ contentReport: { findFirst: vi.fn(async () => ({ id: "x" })), count: vi.fn(async () => 0), create: vi.fn() } });
    const r1 = await createContentReport(dup.ctx(user), { targetType: "VIDEO", targetId: "v1", reason: "HATE" });
    expect(r1.ok).toBe(false);
    const capped = make({ contentReport: { findFirst: vi.fn(async () => null), count: vi.fn(async () => 20), create: vi.fn() } });
    const r2 = await createContentReport(capped.ctx(user), { targetType: "VIDEO", targetId: "v1", reason: "HATE" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect((r2.error as { statusCode?: number }).statusCode).toBe(429);
  });
});
