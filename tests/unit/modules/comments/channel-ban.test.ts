import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { banViewerFromChannel, isBannedFromChannel, listChannelBans, unbanViewerFromChannel } from "@/lib/modules/comments";

vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: vi.fn(), recordAuditEventSafe: vi.fn() }));

const NOW = new Date("2026-10-15T10:00:00Z");

/** `role` is the role of user "mod" in channel c1 (undefined = not a member). */
function makePrisma(role?: string) {
  const tx = { channelBan: { upsert: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) }, auditLog: { create: vi.fn() } };
  const prisma = {
    creator: {
      findUnique: vi.fn(async () => ({
        id: "c1", userId: "owner", status: "ACTIVE",
        members: role ? [{ userId: "mod", role }] : [],
      })),
    },
    user: { findUnique: vi.fn(async () => ({ id: "viewer", role: "USER", isDeleted: false })) },
    channelBan: { findUnique: vi.fn(async () => null as unknown), findMany: vi.fn(async () => []) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  return { prisma, tx };
}

const ctx = (actor: unknown, prisma: unknown) => createAppContext({ actor: actor as never, prisma: prisma as never, now: () => NOW });
const mod = { type: "user" as const, userId: "mod" };
const until = new Date("2026-10-20T00:00:00Z");

describe("channel bans", () => {
  it("lets a MODERATOR ban and unban a viewer, but not an EDITOR or a stranger", async () => {
    const { prisma, tx } = makePrisma("MODERATOR");
    expect((await banViewerFromChannel(ctx(mod, prisma), { channelId: "c1", userId: "viewer", until })).ok).toBe(true);
    expect(tx.channelBan.upsert).toHaveBeenCalledTimes(1);
    prisma.channelBan.findUnique.mockResolvedValueOnce({ userId: "viewer" });
    expect((await unbanViewerFromChannel(ctx(mod, prisma), { channelId: "c1", userId: "viewer" })).ok).toBe(true);

    const editor = makePrisma("EDITOR");
    expect((await banViewerFromChannel(ctx(mod, editor.prisma), { channelId: "c1", userId: "viewer" })).ok).toBe(false);
    const nobody = makePrisma();
    const stranger = { type: "user" as const, userId: "stranger" };
    expect((await banViewerFromChannel(ctx(stranger, nobody.prisma), { channelId: "c1", userId: "viewer" })).ok).toBe(false);
    expect((await listChannelBans(ctx(stranger, nobody.prisma), { channelId: "c1" })).ok).toBe(false);
  });

  it("never bans the owner, a member, yourself or a past date", async () => {
    const { prisma, tx } = makePrisma("MODERATOR");
    const owner = ctx({ type: "user", userId: "owner" }, prisma);
    expect((await banViewerFromChannel(owner, { channelId: "c1", userId: "owner" })).ok).toBe(false);
    expect((await banViewerFromChannel(owner, { channelId: "c1", userId: "mod" })).ok).toBe(false);
    expect((await banViewerFromChannel(owner, { channelId: "c1", userId: "viewer", until: new Date("2026-01-01") })).ok).toBe(false);
    expect(tx.channelBan.upsert).not.toHaveBeenCalled();
  });

  it("treats an expired ban as lifted", async () => {
    const { prisma } = makePrisma();
    prisma.channelBan.findUnique.mockResolvedValueOnce({ until: new Date("2026-10-01") });
    expect(await isBannedFromChannel(prisma as never, "c1", "viewer", NOW)).toBe(false);
    prisma.channelBan.findUnique.mockResolvedValueOnce({ until: null });
    expect(await isBannedFromChannel(prisma as never, "c1", "viewer", NOW)).toBe(true);
  });
});
