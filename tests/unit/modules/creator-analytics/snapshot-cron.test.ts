import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { snapshotSubscriberCounts } from "@/lib/modules/creator-analytics";

/** In-memory SubscriberSnapshot table keyed by (channelId, day) with upsert semantics. */
function build(actor: Actor, now: Date, channels: { id: string; subscribersCount: number; status?: string }[]) {
  const table = new Map<string, number>();
  const prisma = {
    creator: {
      findMany: vi.fn(async ({ where, take, cursor, skip }: { where: { status: { in: string[] } }; take: number; cursor?: { id: string }; skip?: number }) => {
        const all = channels.filter((c) => where.status.in.includes(c.status ?? "ACTIVE")).sort((a, b) => a.id.localeCompare(b.id));
        const start = cursor ? all.findIndex((c) => c.id === cursor.id) + (skip ?? 0) : 0;
        return all.slice(start, start + take).map((c) => ({ id: c.id, subscribersCount: c.subscribersCount }));
      }),
    },
    subscriberSnapshot: {
      upsert: vi.fn(async ({ where, create, update }: { where: { channelId_day: { channelId: string; day: Date } }; create: { subscribers: number }; update: { subscribers: number } }) => {
        const key = `${where.channelId_day.channelId}|${where.channelId_day.day.toISOString().slice(0, 10)}`;
        table.set(key, table.has(key) ? update.subscribers : create.subscribers);
      }),
    },
  };
  const ctx = createAppContext({ actor, prisma: prisma as never, now: () => now }) as AppContext;
  return { ctx, prisma, table };
}

const system: Actor = { type: "system", reason: "subscriber-snapshots-cron" };

describe("snapshotSubscriberCounts", () => {
  it("writes one row per active channel for the UTC day of the run", async () => {
    const { ctx, table } = build(system, new Date("2026-10-14T23:50:00.000Z"), [
      { id: "ch-1", subscribersCount: 10 },
      { id: "ch-2", subscribersCount: 0 },
      { id: "ch-3", subscribersCount: 7, status: "SUSPENDED" },
    ]);
    const r = await snapshotSubscriberCounts(ctx);
    expect(r).toEqual({ ok: true, data: { day: "2026-10-14", channels: 2, written: 2 } });
    expect([...table.entries()].sort()).toEqual([
      ["ch-1|2026-10-14", 10],
      ["ch-2|2026-10-14", 0],
    ]);
  });

  it("is idempotent: a second run the same day keeps one row per channel and only refreshes the count", async () => {
    const channels = [{ id: "ch-1", subscribersCount: 10 }];
    const first = build(system, new Date("2026-10-14T23:50:00.000Z"), channels);
    await snapshotSubscriberCounts(first.ctx);
    channels[0].subscribersCount = 12;
    const second = { ...first, ctx: createAppContext({ actor: system, prisma: first.prisma as never, now: () => new Date("2026-10-14T23:59:00.000Z") }) as AppContext };
    await snapshotSubscriberCounts(second.ctx);
    expect(first.table.size).toBe(1);
    expect(first.table.get("ch-1|2026-10-14")).toBe(12);
  });

  it("starts a new row on the next UTC day and keeps the previous one", async () => {
    const channels = [{ id: "ch-1", subscribersCount: 10 }];
    const day1 = build(system, new Date("2026-10-14T23:50:00.000Z"), channels);
    await snapshotSubscriberCounts(day1.ctx);
    const day2 = createAppContext({ actor: system, prisma: day1.prisma as never, now: () => new Date("2026-10-15T23:50:00.000Z") }) as AppContext;
    await snapshotSubscriberCounts(day2);
    expect([...day1.table.keys()].sort()).toEqual(["ch-1|2026-10-14", "ch-1|2026-10-15"]);
  });

  it("pages through more channels than one page holds", async () => {
    const channels = Array.from({ length: 450 }, (_, i) => ({ id: `ch-${String(i).padStart(4, "0")}`, subscribersCount: i }));
    const { ctx, table } = build(system, new Date("2026-10-14T23:50:00.000Z"), channels);
    const r = await snapshotSubscriberCounts(ctx);
    expect(r.ok && r.data.written).toBe(450);
    expect(table.size).toBe(450);
  });

  it("refuses every actor but the system (a request on behalf of a user or staff cannot run it)", async () => {
    for (const actor of [{ type: "user", userId: "u" } as const, { type: "admin", userId: "a" } as const, { type: "guest" } as const]) {
      const { ctx, prisma } = build(actor, new Date(), [{ id: "ch-1", subscribersCount: 1 }]);
      const r = await snapshotSubscriberCounts(ctx);
      expect(!r.ok && r.error.statusCode).toBe(403);
      expect(prisma.subscriberSnapshot.upsert).not.toHaveBeenCalled();
    }
  });
});

describe("GET /api/cron/subscriber-snapshots", () => {
  const SECRET = "x".repeat(40);
  const makeRequest = (auth?: string) =>
    new NextRequest("http://localhost/api/cron/subscriber-snapshots", { headers: auth ? { Authorization: auth } : {} });

  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = SECRET;
  });

  it("fails closed: 401 without the header, with a wrong secret and when CRON_SECRET is unset", async () => {
    const { GET } = await import("@/app/api/cron/subscriber-snapshots/route");
    expect((await GET(makeRequest())).status).toBe(401);
    expect((await GET(makeRequest("Bearer nope"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(makeRequest("Bearer undefined"))).status).toBe(401);
  });

  it("runs the use case as the system actor and returns its summary", async () => {
    const spy = vi.fn(async (ctx: AppContext) => ({ ok: true as const, data: { day: "2026-10-14", channels: 1, written: 1, actor: ctx.actor.type } }));
    vi.doMock("@/lib/modules/creator-analytics", () => ({ snapshotSubscriberCounts: spy }));
    const { GET } = await import("@/app/api/cron/subscriber-snapshots/route");
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ written: 1, actor: "system" });
    vi.doUnmock("@/lib/modules/creator-analytics");
  });

  it("answers 500 without details when the job fails", async () => {
    vi.doMock("@/lib/modules/creator-analytics", () => ({ snapshotSubscriberCounts: vi.fn(async () => { throw new Error("db password leaked"); }) }));
    const { GET } = await import("@/app/api/cron/subscriber-snapshots/route");
    const res = await GET(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("leaked");
    vi.doUnmock("@/lib/modules/creator-analytics");
  });
});
