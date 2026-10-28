import { describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { authorizeComments, authorizeReport, moderatorId, scopeToChannel } from "@/lib/modules/comments/application/authorize-comments";
import { setAdminCommentHeart } from "@/lib/modules/comments/application/set-admin-comment-heart.use-case";
import { listPanelComments, getModerationCounts } from "@/lib/modules/comments/application/list-panel-comments.use-case";

/** Two channels, one comment under a video of each: owner A must reach A's comment only. */
function ctxFor(actor: Actor, channelId?: string) {
  const video = (creatorId: string, userId: string, status = "ACTIVE") => ({ creatorId, creator: { userId, status } });
  const comments: Record<string, { id: string; video: ReturnType<typeof video> }> = {
    "c-a": { id: "c-a", video: video("ch-a", "user-a") },
    "c-b": { id: "c-b", video: video("ch-b", "user-b") },
    "c-s": { id: "c-s", video: video("ch-s", "user-s", "SUSPENDED") },
  };
  const prisma = {
    comment: {
      findMany: vi.fn(async ({ where }: { where: { id?: { in: string[] } } }) => (where.id?.in ?? []).map((id) => comments[id]).filter(Boolean)),
      count: vi.fn(async () => 0),
    },
    commentReport: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === "r-b" ? { commentId: "c-b" } : where.id === "r-a" ? { commentId: "c-a" } : null)),
      count: vi.fn(async () => 0),
    },
    channelMember: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: undefined,
  };
  const ctx = createAppContext({ actor, prisma: prisma as never, channelId, now: () => new Date("2026-10-13T12:00:00Z") }) as AppContext;
  return { ctx, prisma };
}

const ownerA: Actor = { type: "user", userId: "user-a" };

describe("authorizeComments", () => {
  it("lets the channel owner moderate a comment under their own video", async () => {
    const { ctx } = ctxFor(ownerA);
    expect(await authorizeComments(ctx, "comment.moderate", ["c-a"])).toBeNull();
  });

  it("denies the owner of channel A on a comment under channel B's video", async () => {
    const { ctx } = ctxFor(ownerA);
    expect(await authorizeComments(ctx, "comment.moderate", ["c-b"])).toMatchObject({ type: "UNAUTHORIZED" });
  });

  it("denies the whole batch when one comment belongs to someone else's channel", async () => {
    const { ctx } = ctxFor(ownerA);
    expect(await authorizeComments(ctx, "comment.moderate", ["c-a", "c-b"])).toMatchObject({ type: "UNAUTHORIZED" });
  });

  it("freezes moderation in a suspended channel for its owner", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "user-s" });
    expect(await authorizeComments(ctx, "comment.moderate", ["c-s"])).toMatchObject({ type: "UNAUTHORIZED" });
  });

  it("decides for staff and system without a query, and refuses guests", async () => {
    for (const actor of [{ type: "admin", userId: "adm" } as const, { type: "system", reason: "cron" } as const]) {
      const { ctx, prisma } = ctxFor(actor);
      expect(await authorizeComments(ctx, "comment.moderate", ["c-a", "c-b"])).toBeNull();
      expect(prisma.comment.findMany).not.toHaveBeenCalled();
    }
    const { ctx } = ctxFor({ type: "guest" });
    expect(await authorizeComments(ctx, "comment.moderate", ["c-a"])).toMatchObject({ type: "UNAUTHORIZED" });
  });
});

describe("authorizeReport", () => {
  it("follows the report's comment to its channel", async () => {
    const { ctx } = ctxFor(ownerA);
    expect(await authorizeReport(ctx, "comment.moderate", "r-a")).toBeNull();
    expect(await authorizeReport(ctx, "comment.moderate", "r-b")).toMatchObject({ type: "UNAUTHORIZED" });
    expect(await authorizeReport(ctx, "comment.moderate", "missing")).toBeNull();
  });
});

describe("scopeToChannel", () => {
  it("requires a user to name a channel they may moderate", async () => {
    const none = ctxFor(ownerA);
    expect(await scopeToChannel(none.ctx, "comment.moderate")).toMatchObject({ error: { type: "UNAUTHORIZED" } });
  });

  it("takes the channel from the context and refuses someone else's", async () => {
    const own = ctxFor(ownerA, "ch-a");
    // loadChannel needs the creator row: give the fake one.
    (own.prisma as unknown as { creator: unknown }).creator = {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, userId: where.id === "ch-a" ? "user-a" : "user-b", status: "ACTIVE", members: [] })),
    };
    expect(await scopeToChannel(own.ctx, "comment.moderate")).toEqual({ channelId: "ch-a" });
    expect(await scopeToChannel(own.ctx, "comment.moderate", "ch-b")).toMatchObject({ error: { type: "UNAUTHORIZED" } });
  });

  it("staff may list across channels (no channel) or one channel", async () => {
    const { ctx } = ctxFor({ type: "admin", userId: "adm" });
    expect(await scopeToChannel(ctx, "comment.moderate")).toEqual({ channelId: null });
    expect(await scopeToChannel(ctx, "comment.moderate", "ch-b")).toEqual({ channelId: "ch-b" });
  });
});

describe("moderation use cases", () => {
  it("refuse before touching anything when the actor may not moderate that channel", async () => {
    const { ctx, prisma } = ctxFor(ownerA);
    const result = await setAdminCommentHeart(ctx, { commentId: "c-b", hearted: true });
    expect(!result.ok && result.error.type).toBe("UNAUTHORIZED");
    expect(prisma.comment.findMany).toHaveBeenCalledTimes(1);
  });

  it("panel lists need a channel for a user and are filtered by it", async () => {
    const withoutChannel = ctxFor(ownerA);
    const refused = await listPanelComments(withoutChannel.ctx, {});
    expect(!refused.ok && refused.error.type).toBe("UNAUTHORIZED");
    const counts = await getModerationCounts(withoutChannel.ctx);
    expect(counts.ok).toBe(false);
  });

  it("records the moderator id (account, or system job reason)", () => {
    expect(moderatorId(ctxFor(ownerA).ctx)).toBe("user-a");
    expect(moderatorId(ctxFor({ type: "admin", userId: "adm" }).ctx)).toBe("adm");
    expect(moderatorId(ctxFor({ type: "system", reason: "cron" }).ctx)).toBe("system:cron");
  });
});
