import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({
  flags: { mainCreatorSlug: "main-slug" },
}));

import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";

type Row = Record<string, unknown>;

function ctxWith(rows: Row[], channelId?: string) {
  const creator = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
      rows.find((r) => (where.id ? r.id === where.id : r.slug === where.slug)) ?? null,
    ),
  };
  const ctx = createAppContext({ actor: { type: "guest" }, prisma: { creator } as never, channelId }) as AppContext;
  return { ctx, creator };
}

const main = { id: "main", slug: "main-slug", isApproved: true, isPrimary: true, status: "ACTIVE", deletedAt: null };
const other = { id: "other", slug: "other", isApproved: false, isPrimary: false, status: "PENDING_REVIEW", deletedAt: null };

describe("MainChannelService with an active channel (CLAUDE.md 4.24)", () => {
  it("returns the configured main channel when the context names no channel", async () => {
    const { ctx, creator } = ctxWith([main, other]);
    const channel = await MainChannelService.getRequired(ctx);
    expect(channel.id).toBe("main");
    expect(creator.findUnique).toHaveBeenCalledWith({ where: { slug: "main-slug" } });
  });

  it("returns the context's channel by id, without the main-channel flags", async () => {
    const { ctx, creator } = ctxWith([main, other], "other");
    const channel = await MainChannelService.getRequired(ctx);
    expect(channel.id).toBe("other");
    expect(creator.findUnique).toHaveBeenCalledWith({ where: { id: "other" } });
    expect(await MainChannelService.getOptional(ctx)).toMatchObject({ id: "other" });
  });

  it("does not find an unknown, deleted or soft-deleted channel", async () => {
    const unknown = ctxWith([main], "missing");
    await expect(MainChannelService.getRequired(unknown.ctx)).rejects.toMatchObject({ statusCode: 404, code: "CHANNEL_NOT_FOUND" });
    expect(await MainChannelService.getOptional(unknown.ctx)).toBeNull();

    const deleted = ctxWith([{ ...other, status: "DELETED" }], "other");
    await expect(MainChannelService.getRequired(deleted.ctx)).rejects.toMatchObject({ statusCode: 404 });

    const soft = ctxWith([{ ...other, deletedAt: new Date() }], "other");
    await expect(MainChannelService.getRequired(soft.ctx)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("still insists the main channel is approved and primary when no channel is named", async () => {
    const notPrimary = ctxWith([{ ...main, isPrimary: false }]);
    await expect(MainChannelService.getRequired(notPrimary.ctx)).rejects.toMatchObject({ code: "CHANNEL_NOT_PRIMARY" });
  });
});
