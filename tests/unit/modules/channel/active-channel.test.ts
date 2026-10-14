import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService, resolveMainChannelId, isMainChannelId, MAIN_CHANNEL_SETTING_KEY } from "@/lib/modules/channel";

type Row = Record<string, unknown>;

function ctxWith(rows: Row[], opts: { channelId?: string; setting?: string | null } = {}) {
  const creator = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
      rows.find((r) => (where.id ? r.id === where.id : r.slug === where.slug)) ?? null,
    ),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const appSetting = {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
      where.key === MAIN_CHANNEL_SETTING_KEY && opts.setting ? { key: where.key, value: opts.setting } : null,
    ),
  };
  const ctx = createAppContext({ actor: { type: "guest" }, prisma: { creator, appSetting } as never, channelId: opts.channelId }) as AppContext;
  return { ctx, creator, appSetting };
}

const main = { id: "main", slug: "main-slug", status: "ACTIVE", deletedAt: null };
const other = { id: "other", slug: "other", status: "PENDING_REVIEW", deletedAt: null };

afterEach(() => vi.unstubAllEnvs());

describe("MainChannelService with an active channel (CLAUDE.md 4.24)", () => {
  it("returns the channel named by the main_channel_id setting when the context names no channel", async () => {
    const { ctx, creator, appSetting } = ctxWith([main, other], { setting: "main" });
    const channel = await MainChannelService.getRequired(ctx);
    expect(channel.id).toBe("main");
    expect(appSetting.findUnique).toHaveBeenCalledWith({ where: { key: "main_channel_id" } });
    expect(creator.findUnique).toHaveBeenCalledWith({ where: { id: "main" } });
  });

  it("returns the context's channel by id, without reading the main-channel setting", async () => {
    const { ctx, creator, appSetting } = ctxWith([main, other], { channelId: "other", setting: "main" });
    const channel = await MainChannelService.getRequired(ctx);
    expect(channel.id).toBe("other");
    expect(creator.findUnique).toHaveBeenCalledWith({ where: { id: "other" } });
    expect(appSetting.findUnique).not.toHaveBeenCalled();
    expect(await MainChannelService.getOptional(ctx)).toMatchObject({ id: "other" });
  });

  it("does not find an unknown, deleted or soft-deleted channel", async () => {
    const unknown = ctxWith([main], { channelId: "missing" });
    await expect(MainChannelService.getRequired(unknown.ctx)).rejects.toMatchObject({ statusCode: 404, code: "CHANNEL_NOT_FOUND" });
    expect(await MainChannelService.getOptional(unknown.ctx)).toBeNull();

    const deleted = ctxWith([{ ...other, status: "DELETED" }], { channelId: "other" });
    await expect(MainChannelService.getRequired(deleted.ctx)).rejects.toMatchObject({ statusCode: 404 });

    const soft = ctxWith([{ ...other, deletedAt: new Date() }], { channelId: "other" });
    await expect(MainChannelService.getRequired(soft.ctx)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("insists the main channel is publicly visible (status ACTIVE or LIMITED) when no channel is named", async () => {
    const pending = ctxWith([{ ...main, status: "PENDING_REVIEW" }], { setting: "main" });
    await expect(MainChannelService.getRequired(pending.ctx)).rejects.toMatchObject({ code: "CHANNEL_NOT_APPROVED" });

    const limited = ctxWith([{ ...main, status: "LIMITED" }], { setting: "main" });
    await expect(MainChannelService.getRequired(limited.ctx)).resolves.toMatchObject({ id: "main" });
  });

  it("status alone decides: no legacy flag is needed on the row", async () => {
    const { ctx } = ctxWith([main], { setting: "main" });
    await expect(MainChannelService.getRequired(ctx)).resolves.toMatchObject({ id: "main" });
  });
});

describe("main channel resolution (stage 8, deployment B: the setting is the only source)", () => {
  it("reads only the setting, never a slug variable or a flag on the row", async () => {
    vi.stubEnv("MAIN_CREATOR_SLUG", "other");
    const { ctx, creator } = ctxWith([main, other], { setting: "main" });
    expect((await MainChannelService.getOptional(ctx))?.id).toBe("main");
    expect(creator.findFirst).not.toHaveBeenCalled();
  });

  it("has no main channel when the setting is missing, even if MAIN_CREATOR_SLUG is set", async () => {
    vi.stubEnv("MAIN_CREATOR_SLUG", "main-slug");
    const { ctx, creator } = ctxWith([main, other], { setting: null });
    expect(await MainChannelService.getOptional(ctx)).toBeNull();
    await expect(MainChannelService.getRequired(ctx)).rejects.toMatchObject({ code: "CHANNEL_NOT_FOUND" });
    expect(creator.findFirst).not.toHaveBeenCalled();
  });

  it("has no main channel when the setting points at a channel that no longer exists", async () => {
    const { ctx } = ctxWith([main], { setting: "vanished" });
    expect(await MainChannelService.getOptional(ctx)).toBeNull();
  });

  it("only reads: resolving the main channel never writes a channel row", async () => {
    const { ctx, creator } = ctxWith([main], { setting: "main" });
    await MainChannelService.getRequired(ctx);
    expect(creator.update).not.toHaveBeenCalled();
    expect(creator.updateMany).not.toHaveBeenCalled();
  });

  it("answers 'is this the main channel' by id (the one helper for main-channel comparisons)", async () => {
    const { ctx } = ctxWith([main, other], { setting: "main" });
    expect(await resolveMainChannelId(ctx.prisma)).toBe("main");
    expect(await isMainChannelId(ctx.prisma, "main")).toBe(true);
    expect(await isMainChannelId(ctx.prisma, "other")).toBe(false);
    expect(await isMainChannelId(ctx.prisma, null)).toBe(false);
    expect(await MainChannelService.isMainChannel(ctx, "main")).toBe(true);
  });
});
