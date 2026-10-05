import { describe, expect, it, vi } from "vitest";
import { ExportOwnDataUseCase } from "@/lib/modules/users/application/export-own-data.use-case";

function fakeCtx() {
  const find = (rows: unknown[]) => ({ findMany: vi.fn(async () => rows) });
  const prisma = {
    user: { findUnique: vi.fn(async () => ({ id: "u1", email: "a@example.com" })) },
    comment: find([{ id: "c1", text: "hi" }]),
    videoLike: find([{ videoId: "v1", createdAt: new Date(0) }]),
    videoDislike: find([{ videoId: "v2", createdAt: new Date(0) }]),
    commentReaction: find([]),
    subscription: find([]),
    emailPreference: find([]),
    payment: find([{ id: "p1", amountMinor: 500, currency: "PLN", status: "SUCCEEDED" }]),
  };
  return { prisma, ctx: { prisma, now: () => new Date("2026-10-05T10:00:00Z") } as never };
}

describe("ExportOwnDataUseCase", () => {
  it("returns only the person's own rows and merges likes and dislikes", async () => {
    const { ctx, prisma } = fakeCtx();
    const data = await ExportOwnDataUseCase.execute(ctx, "u1");

    expect(data.exportedAt).toBe("2026-10-05T10:00:00.000Z");
    expect(data.account).toMatchObject({ id: "u1" });
    expect(data.comments).toHaveLength(1);
    expect(data.videoReactions.map((r) => r.type).sort()).toEqual(["dislike", "like"]);
    expect(data.payments).toHaveLength(1);
    // every query is scoped to this account
    expect(prisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { authorId: "u1" } }));
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    expect(prisma.emailPreference.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
  });

  it("never selects secrets, tokens or IP addresses", async () => {
    const { ctx, prisma } = fakeCtx();
    await ExportOwnDataUseCase.execute(ctx, "u1");
    const selects = JSON.stringify([
      prisma.user.findUnique.mock.calls,
      prisma.comment.findMany.mock.calls,
      prisma.payment.findMany.mock.calls,
    ]);
    expect(selects).not.toMatch(/password|token|secret|ipAddress|userAgent|stripeCustomerId|stripeIntentId/i);
  });
});
