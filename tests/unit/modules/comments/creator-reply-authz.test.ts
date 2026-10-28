import { beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => ({})) }));
vi.mock("@/lib/modules/audit", () => ({
  recordAuditEvent: audit.recordAuditEvent,
  recordAuditEventSafe: vi.fn(),
}));

import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { createCreatorReply } from "@/lib/modules/comments/application/create-creator-reply.use-case";

function ctxFor(actor: Actor, channelStatus = "ACTIVE") {
  const comment = {
    findUnique: vi.fn(async () => ({
      id: "c1",
      status: "VISIBLE",
      parentId: null,
      videoId: "v1",
      isHearted: false,
      author: { isDeleted: false },
      video: { creatorId: "ch-1", creator: { userId: "u-owner", status: channelStatus } },
    })),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({ id: "reply-1" })),
    update: vi.fn(async () => ({})),
  };
  const prisma = { comment, channelMember: { findMany: vi.fn().mockResolvedValue([]) } };
  const ctx = createAppContext({ actor, prisma: prisma as never, now: () => new Date("2026-10-13T12:00:00Z") }) as AppContext;
  return { ctx, comment };
}

describe("createCreatorReply authorization (CLAUDE.md 4.23)", () => {
  beforeEach(() => audit.recordAuditEvent.mockClear());

  it("the channel owner answers as themselves", async () => {
    const { ctx, comment } = ctxFor({ type: "user", userId: "u-owner" });
    const result = await createCreatorReply(ctx, { commentId: "c1", text: "Dzięki!" });
    expect(result.ok).toBe(true);
    expect(comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "u-owner", creatorId: "ch-1" }) }));
  });

  it("another user cannot answer as the creator of someone else's channel", async () => {
    const { ctx, comment } = ctxFor({ type: "user", userId: "u-attacker" });
    const result = await createCreatorReply(ctx, { commentId: "c1", text: "Hej" });
    expect(!result.ok && result.error.type).toBe("UNAUTHORIZED");
    expect(comment.create).not.toHaveBeenCalled();
  });

  it("platform staff (legacy) answers as the owner and the audit row says on whose behalf", async () => {
    const { ctx, comment } = ctxFor({ type: "admin", userId: "adm" });
    const result = await createCreatorReply(ctx, { commentId: "c1", text: "Odpowiedź" });
    expect(result.ok).toBe(true);
    expect(comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "u-owner" }) }));
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ channelId: "ch-1", metadata: expect.objectContaining({ onBehalfOf: "u-owner" }) }),
      expect.anything(),
    );
  });

  it("a guest and a suspended channel cannot answer", async () => {
    const guest = ctxFor({ type: "guest" });
    const refused = await createCreatorReply(guest.ctx, { commentId: "c1", text: "Hej" });
    expect(!refused.ok && refused.error.type).toBe("UNAUTHORIZED");

    const frozen = ctxFor({ type: "user", userId: "u-owner" }, "SUSPENDED");
    const blocked = await createCreatorReply(frozen.ctx, { commentId: "c1", text: "Hej" });
    expect(!blocked.ok && blocked.error.type).toBe("UNAUTHORIZED");
    expect(frozen.comment.create).not.toHaveBeenCalled();
  });
});
