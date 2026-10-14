import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({ flags: {} }));
const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => undefined), recordAuditEventSafe: vi.fn(async () => undefined) }));
vi.mock("@/lib/modules/audit", () => audit);

import { changeChannelOwner, findChannelOwnerCandidates, getChannelOwner, updateAdminChannelSettings } from "@/lib/modules/channel";
import type { AppContext } from "@/lib/modules/shared/app-context";

const channel = { id: "ch1", slug: "main", name: "Kanał", bio: "Opis", userId: "u-old", status: 'ACTIVE' };

function makeCtx(over: { actor?: AppContext["actor"]; user?: object | null; updateCount?: number } = {}) {
  const prisma = {
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn(async () => channel), updateMany: vi.fn(async () => ({ count: over.updateCount ?? 1 })), update: vi.fn(async ({ data }: { data: object }) => ({ ...channel, ...data })) },
    user: { findUnique: vi.fn(async () => (over.user === undefined ? { id: "u-new", email: "new@x.pl", name: "Nowy", isDeleted: false } : over.user)), findMany: vi.fn(async () => [{ id: "u-new", email: "new@x.pl", name: "Nowy" }]) },
  };
  const ctx = { actor: over.actor ?? { type: "admin", userId: "adm1" }, prisma, db: { read: prisma, writeTransaction: async (fn: (tx: unknown) => unknown) => fn(prisma) } } as unknown as AppContext;
  return { ctx, prisma };
}

beforeEach(() => vi.clearAllMocks());

describe("changeChannelOwner", () => {
  it("moves the creator to the new account with a compare-and-set and audits old and new owner plus reason", async () => {
    const { ctx, prisma } = makeCtx();
    const r = await changeChannelOwner(ctx, { userId: "u-new", reason: "zmiana konta" });
    expect(r).toMatchObject({ ok: true, data: { previousUserId: "u-old", owner: { email: "new@x.pl" } } });
    expect(prisma.creator.updateMany).toHaveBeenCalledWith({ where: { id: "ch1", userId: "u-old" }, data: { userId: "u-new" } });
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "CHANNEL_OWNER_CHANGED", targetId: "ch1", metadata: { before: { userId: "u-old" }, after: { userId: "u-new" }, reason: "zmiana konta" } }), expect.anything());
  });

  it("refuses non-admins, the same owner, deleted or unknown accounts and a lost race", async () => {
    expect(await changeChannelOwner(makeCtx({ actor: { type: "user", userId: "u" } }).ctx, { userId: "u-new" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await changeChannelOwner(makeCtx().ctx, { userId: "u-old" })).toMatchObject({ ok: false, error: { code: "CHANNEL_OWNER_UNCHANGED" } });
    expect(await changeChannelOwner(makeCtx({ user: null }).ctx, { userId: "x" })).toMatchObject({ ok: false, error: { code: "CHANNEL_OWNER_NOT_FOUND" } });
    expect(await changeChannelOwner(makeCtx({ user: { id: "x", email: "d@x", name: null, isDeleted: true } }).ctx, { userId: "x" })).toMatchObject({ ok: false, error: { code: "CHANNEL_OWNER_NOT_FOUND" } });
    const race = makeCtx({ updateCount: 0 });
    expect(await changeChannelOwner(race.ctx, { userId: "u-new" })).toMatchObject({ ok: false, error: { code: "CHANNEL_OWNER_CONFLICT" } });
    expect(audit.recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("findChannelOwnerCandidates / getChannelOwner", () => {
  it("needs 3 characters, excludes deleted accounts and caps the list", async () => {
    const { ctx, prisma } = makeCtx();
    expect(await findChannelOwnerCandidates(ctx, "ab")).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    await findChannelOwnerCandidates(ctx, "  new@  ");
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 8, where: expect.objectContaining({ isDeleted: false }) }));
    await expect(findChannelOwnerCandidates(makeCtx({ actor: { type: "guest" } }).ctx, "abc")).rejects.toMatchObject({ statusCode: 401 });
    expect(await getChannelOwner(ctx)).toBeTruthy();
  });
});

describe("updateAdminChannelSettings audit", () => {
  it("records before and after of name and bio", async () => {
    const { ctx } = makeCtx();
    await updateAdminChannelSettings(ctx, { name: "Nowa nazwa", bio: "Nowy opis" });
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "CHANNEL_UPDATED", metadata: expect.objectContaining({ fields: ["name", "bio"], before: { name: "Kanał", bio: "Opis" }, after: { name: "Nowa nazwa", bio: "Nowy opis" } }) }));
  });
});
