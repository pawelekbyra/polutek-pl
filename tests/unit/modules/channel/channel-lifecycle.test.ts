import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => ({})) }));
vi.mock("@/lib/modules/audit", () => ({
  recordAuditEvent: audit.recordAuditEvent,
  recordAuditEventSafe: vi.fn(),
}));

import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import {
  CHANNEL_DELETION_GRACE_DAYS,
  HANDLE_RESERVATION_DAYS,
  changeChannelHandle,
  checkHandleAvailability,
  createChannel,
  listMyChannels,
  requestChannelDeletion,
  restoreChannel,
  updateChannelProfile,
} from "@/lib/modules/channel";

const NOW = new Date("2026-10-13T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

function makeCtx(actor: Actor, opts: { settings?: Record<string, string>; channels?: Row[]; recentChanges?: number; channelId?: string } = {}) {
  const channels = opts.channels ?? [];
  const settings = opts.settings ?? {};
  const created: Row[] = [];
  const db = {
    appSetting: { findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (settings[where.key] !== undefined ? { key: where.key, value: settings[where.key] } : null)) },
    user: { findUnique: vi.fn(async () => ({ email: "anna@example.com" })) },
    creator: {
      count: vi.fn(async ({ where }: { where: { userId: string } }) => channels.filter((c) => c.userId === where.userId && !c.deletedAt).length),
      findFirst: vi.fn(async ({ where }: { where: { OR: Array<{ handle?: { equals: string }; slug?: { equals: string } }>; id?: { not: string } } }) => {
        const wanted = where.OR[0].handle?.equals;
        return (
          channels.find(
            (c) =>
              c.id !== where.id?.not &&
              (String(c.handle ?? "").toLowerCase() === wanted || String(c.slug ?? "").toLowerCase() === wanted),
          ) ?? null
        );
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => channels.find((c) => c.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => channels.find((c) => c.id === where.id)),
      findMany: vi.fn(async () => channels),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: "new-channel", isVerified: false, ...data };
        created.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => ({ ...(channels.find((c) => c.id === where.id) ?? {}), ...data })),
    },
    channelHandleHistory: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    channelMember: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    channelQuota: { create: vi.fn(async () => ({})) },
    auditLog: { count: vi.fn(async () => opts.recentChanges ?? 0) },
  };
  const ctx = createAppContext({ actor, prisma: db as never, now: () => NOW, channelId: opts.channelId }) as AppContext;
  return { ctx, db, created };
}

const owner: Actor = { type: "user", userId: "u-owner" };
const own = { id: "ch-1", slug: "moj-kanal", handle: "moj-kanal", name: "Mój kanał", userId: "u-owner", status: "ACTIVE", deletedAt: null, deleteAfter: null };

describe("createChannel", () => {
  beforeEach(() => {
    audit.recordAuditEvent.mockClear();
  });
  afterEach(() => {
    delete process.env.PLATFORM_GATE_CHANNEL_CREATION;
  });

  it("is closed while the gate is off (the default)", async () => {
    const { ctx, db } = makeCtx(owner);
    const result = await createChannel(ctx, { name: "Kanał", handle: "kanal" });
    expect(!result.ok && result.error.code).toBe("CHANNEL_CREATION_CLOSED");
    expect(db.creator.create).not.toHaveBeenCalled();
  });

  it("needs a signed-in user", async () => {
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "on";
    const { ctx } = makeCtx({ type: "guest" });
    const result = await createChannel(ctx, { name: "Kanał", handle: "kanal" });
    expect(!result.ok && result.error.statusCode).toBe(401);
  });

  it("creates the channel, its owner membership and quota, and audits it (open mode waits for review)", async () => {
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "on";
    const { ctx, db, created } = makeCtx(owner);
    const result = await createChannel(ctx, { name: "  Mój   Kanał ", handle: "@Moj.Kanal", language: "pl" });
    expect(result.ok).toBe(true);
    expect(created[0]).toMatchObject({ userId: "u-owner", slug: "moj.kanal", handle: "moj.kanal", name: "Mój Kanał", status: "PENDING_REVIEW" });
    // Stage 8: the legacy flags are never written (the columns keep their defaults).
    expect(created[0]).not.toHaveProperty("isApproved");
    expect(created[0]).not.toHaveProperty("isPrimary");
    expect(db.channelMember.create).toHaveBeenCalledWith({ data: expect.objectContaining({ channelId: "new-channel", userId: "u-owner", role: "OWNER" }) });
    expect(db.channelQuota.create).toHaveBeenCalledTimes(1);
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "CHANNEL_CREATED", channelId: "new-channel" }), expect.anything());
  });

  it("invite mode: only the invited, and an invited channel is active at once", async () => {
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "invite";
    const stranger = makeCtx(owner);
    const refused = await createChannel(stranger.ctx, { name: "Kanał", handle: "kanal" });
    expect(!refused.ok && refused.error.code).toBe("CHANNEL_INVITE_REQUIRED");

    const invited = makeCtx(owner, { settings: { channel_creation_invites: JSON.stringify(["Anna@Example.com"]) } });
    const accepted = await createChannel(invited.ctx, { name: "Kanał", handle: "kanal" });
    expect(accepted.ok).toBe(true);
    expect(invited.created[0]).toMatchObject({ status: "ACTIVE" });
    expect(invited.created[0]).not.toHaveProperty("isApproved");
  });

  it("enforces one channel per user by default and the configured limit otherwise", async () => {
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "on";
    const first = makeCtx(owner, { channels: [own] });
    const refused = await createChannel(first.ctx, { name: "Drugi", handle: "drugi" });
    expect(!refused.ok && refused.error.code).toBe("CHANNEL_LIMIT_REACHED");

    const raised = makeCtx(owner, { channels: [own], settings: { max_channels_per_user: "3" } });
    expect((await createChannel(raised.ctx, { name: "Drugi", handle: "drugi" })).ok).toBe(true);
  });

  it("rejects a taken handle with suggestions, and invalid names and handles with 400", async () => {
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "on";
    const other = { ...own, id: "ch-x", userId: "someone", handle: "kanal", slug: "kanal" };
    const taken = makeCtx(owner, { channels: [other] });
    const result = await createChannel(taken.ctx, { name: "Kanał", handle: "kanal" });
    expect(!result.ok && result.error.statusCode).toBe(409);
    const availability = await checkHandleAvailability(taken.ctx, "kanal");
    expect(availability.available).toBe(false);
    if (!availability.available) expect(availability.suggestions.length).toBeGreaterThan(0);

    const badName = await createChannel(makeCtx(owner).ctx, { name: "   ", handle: "kanal" });
    expect(!badName.ok && badName.error.statusCode).toBe(400);
    const badHandle = await createChannel(makeCtx(owner).ctx, { name: "Kanał", handle: "admin" });
    expect(!badHandle.ok && badHandle.error.code).toBe("CHANNEL_HANDLE_RESERVED");
  });

  it("staff does not create channels (they have no user account to own one)", async () => {
    process.env.PLATFORM_GATE_CHANNEL_CREATION = "on";
    const { ctx } = makeCtx({ type: "admin", userId: "adm" });
    const result = await createChannel(ctx, { name: "Kanał", handle: "kanal" });
    expect(!result.ok && result.error.statusCode).toBe(401);
  });
});

describe("changeChannelHandle", () => {
  beforeEach(() => audit.recordAuditEvent.mockClear());

  it("reserves the old handle for 180 days and audits the change", async () => {
    const { ctx, db } = makeCtx(owner, { channels: [own], channelId: "ch-1" });
    const result = await changeChannelHandle(ctx, "nowy.kanal");
    expect(result.ok).toBe(true);
    const history = (db.channelHandleHistory.create.mock.calls[0] as unknown as [{ data: { handle: string; reservedUntil: Date } }])[0].data;
    expect(history.handle).toBe("moj-kanal");
    expect(history.reservedUntil.getTime()).toBe(NOW.getTime() + HANDLE_RESERVATION_DAYS * DAY);
    expect(db.creator.update).toHaveBeenCalledWith(expect.objectContaining({ data: { handle: "nowy.kanal" } }));
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "CHANNEL_HANDLE_CHANGED", channelId: "ch-1" }), expect.anything());
  });

  it("allows at most two changes in 14 days", async () => {
    const { ctx, db } = makeCtx(owner, { channels: [own], channelId: "ch-1", recentChanges: 2 });
    const result = await changeChannelHandle(ctx, "nowy.kanal");
    expect(!result.ok && result.error.statusCode).toBe(429);
    expect(db.creator.update).not.toHaveBeenCalled();
  });

  it("is a no-op for the same handle and refuses someone else's channel", async () => {
    const same = makeCtx(owner, { channels: [own], channelId: "ch-1" });
    expect((await changeChannelHandle(same.ctx, "@Moj-Kanal")).ok).toBe(true);
    expect(same.db.creator.update).not.toHaveBeenCalled();

    const stranger = makeCtx({ type: "user", userId: "u-other" }, { channels: [own], channelId: "ch-1" });
    const denied = await changeChannelHandle(stranger.ctx, "nowy.kanal");
    expect(!denied.ok && denied.error.statusCode).toBe(403);
  });
});

describe("updateChannelProfile", () => {
  it("renames within the rate limit and refuses a third change", async () => {
    const ok = makeCtx(owner, { channels: [own], channelId: "ch-1" });
    expect((await updateChannelProfile(ok.ctx, { name: "Nowa nazwa" })).ok).toBe(true);
    expect(audit.recordAuditEvent).toHaveBeenCalledWith(ok.ctx, expect.objectContaining({ action: "CHANNEL_RENAMED" }), expect.anything());

    const limited = makeCtx(owner, { channels: [own], channelId: "ch-1", recentChanges: 2 });
    const refused = await updateChannelProfile(limited.ctx, { name: "Jeszcze inna" });
    expect(!refused.ok && refused.error.code).toBe("CHANNEL_RENAME_RATE_LIMITED");
  });

  it("keeps the platform's name for staff and caps the bio", async () => {
    const brand = makeCtx(owner, { channels: [own], channelId: "ch-1" });
    const result = await updateChannelProfile(brand.ctx, { name: "Paweł Perfect Fan" });
    expect(!result.ok && result.error.code).toBe("CHANNEL_NAME_RESERVED_BRAND");

    const long = makeCtx(owner, { channels: [own], channelId: "ch-1" });
    const tooLong = await updateChannelProfile(long.ctx, { bio: "x".repeat(1001) });
    expect(!tooLong.ok && tooLong.error.code).toBe("CHANNEL_BIO_TOO_LONG");
  });
});

describe("requestChannelDeletion and restoreChannel", () => {
  it("soft deletes with a 30 day grace period and refuses the primary channel", async () => {
    const { ctx, db } = makeCtx(owner, { channels: [own], channelId: "ch-1" });
    const result = await requestChannelDeletion(ctx);
    expect(result.ok && result.data.deleteAfter.getTime()).toBe(NOW.getTime() + CHANNEL_DELETION_GRACE_DAYS * DAY);
    expect(db.creator.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELETED", statusReason: "OWNER_DELETED" }) }));
    const written = (db.creator.update.mock.calls[0] as unknown as [{ data: Row }])[0].data;
    expect(written).not.toHaveProperty("isApproved");

    // The main channel is the main_channel_id setting, not a flag on the row.
    const primary = makeCtx(owner, { channels: [own], channelId: "ch-1", settings: { main_channel_id: "ch-1" } });
    const refused = await requestChannelDeletion(primary.ctx);
    expect(!refused.ok && refused.error.code).toBe("CHANNEL_PRIMARY_PROTECTED");
  });

  it("restores for the owner inside the grace period, not after it, not for a staff deletion", async () => {
    const deleted = { ...own, status: "DELETED", deletedAt: NOW, deleteAfter: new Date(NOW.getTime() + 5 * DAY), statusReason: "OWNER_DELETED" };
    const inside = makeCtx(owner, { channels: [deleted] });
    expect((await restoreChannel(inside.ctx, "ch-1")).ok).toBe(true);
    const restoredData = (inside.db.creator.update.mock.calls[0] as unknown as [{ data: Row }])[0].data;
    expect(restoredData).toMatchObject({ status: "ACTIVE", deletedAt: null });
    expect(restoredData).not.toHaveProperty("isApproved");

    const expired = makeCtx(owner, { channels: [{ ...deleted, deleteAfter: new Date(NOW.getTime() - 1000) }] });
    const late = await restoreChannel(expired.ctx, "ch-1");
    expect(!late.ok && late.error.statusCode).toBe(410);

    const byStaff = makeCtx(owner, { channels: [{ ...deleted, statusReason: "STAFF_REMOVED" }] });
    const denied = await restoreChannel(byStaff.ctx, "ch-1");
    expect(!denied.ok && denied.error.statusCode).toBe(403);

    const stranger = makeCtx({ type: "user", userId: "u-other" }, { channels: [deleted] });
    const notYours = await restoreChannel(stranger.ctx, "ch-1");
    expect(!notYours.ok && notYours.error.statusCode).toBe(403);
  });

  it("a channel that is not deleted cannot be restored", async () => {
    const { ctx } = makeCtx(owner, { channels: [own] });
    const result = await restoreChannel(ctx, "ch-1");
    expect(!result.ok && result.error.statusCode).toBe(404);
  });
});

describe("listMyChannels", () => {
  it("returns nothing for guests and falls back to the owner column", async () => {
    expect(await listMyChannels(makeCtx({ type: "guest" }).ctx)).toEqual([]);
    const { ctx } = makeCtx(owner, { channels: [own] });
    expect(await listMyChannels(ctx)).toHaveLength(1);
  });
});
