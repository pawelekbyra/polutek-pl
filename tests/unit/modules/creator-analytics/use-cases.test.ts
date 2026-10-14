import { describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import {
  exportChannelAnalyticsCsv,
  getChannelAnalyticsOverview,
  getChannelVideoAnalytics,
  getChannelVideoDetail,
} from "@/lib/modules/creator-analytics";

const NOW = new Date("2026-10-14T12:00:00.000Z");

type Member = { userId: string; role: string };
interface Fixture {
  channels?: Record<string, { userId: string; status?: string; members?: Member[]; subscribersCount?: number; handle?: string | null }>;
  rawResponder?: (sql: string, values: unknown[]) => unknown[];
}

/** An in-memory Prisma double: just the delegates the analytics repository and authz touch. */
function build(actor: Actor, channelId: string | undefined, fx: Fixture = {}) {
  const channels = fx.channels ?? {
    "ch-a": { userId: "user-a", subscribersCount: 120, handle: "alpha" },
    "ch-b": { userId: "user-b", subscribersCount: 5, handle: "beta" },
    "ch-team": {
      userId: "user-b",
      members: [
        { userId: "user-ed", role: "EDITOR" },
        { userId: "user-mod", role: "MODERATOR" },
      ],
    },
  };
  const rawCalls: { sql: string; values: unknown[] }[] = [];
  const prisma = {
    creator: {
      findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: { members?: { where: { userId: string } } } }) => {
        const c = channels[where.id];
        if (!c) return null;
        const askedUser = select?.members?.where.userId;
        return {
          id: where.id,
          userId: c.userId,
          status: c.status ?? "ACTIVE",
          name: `Channel ${where.id}`,
          handle: c.handle ?? null,
          subscribersCount: c.subscribersCount ?? 0,
          deletedAt: null,
          members: (c.members ?? []).filter((m) => m.userId === askedUser),
        };
      }),
    },
    video: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; creatorId: string } }) =>
        where.creatorId === "ch-a" && where.id === "vid-1"
          ? { id: "vid-1", title: "First", slug: "first", status: "PUBLISHED", publishedAt: new Date("2026-10-01T00:00:00.000Z") }
          : null,
      ),
      findMany: vi.fn(async () => [
        { id: "vid-1", title: "First", slug: "first", status: "PUBLISHED", publishedAt: new Date("2026-10-01T00:00:00.000Z") },
        { id: "vid-2", title: "=HYPERLINK(\"http://x\")", slug: "second", status: "PUBLISHED", publishedAt: null },
      ]),
    },
    videoView: { groupBy: vi.fn(async () => [{ videoId: "vid-1", _count: { _all: 7 } }]) },
    comment: { groupBy: vi.fn(async () => [{ videoId: "vid-1", _count: { _all: 2 } }]), count: vi.fn(async () => 3) },
    videoLike: { groupBy: vi.fn(async () => [{ videoId: "vid-1", _count: { _all: 4 } }]) },
    subscription: { count: vi.fn(async () => 12) },
    subscriberSnapshot: {
      findMany: vi.fn(async () => [
        { day: new Date("2026-10-07T00:00:00.000Z"), subscribers: 100 },
        { day: new Date("2026-10-13T00:00:00.000Z"), subscribers: 118 },
      ]),
      findFirst: vi.fn(async () => ({ day: new Date("2026-10-13T00:00:00.000Z") })),
    },
    $queryRaw: vi.fn(async (query: { sql?: string; strings?: string[]; values?: unknown[] }) => {
      const sql = (query.sql ?? (query.strings ?? []).join("?")).replace(/\s+/g, " ");
      const values = query.values ?? [];
      rawCalls.push({ sql, values });
      if (fx.rawResponder) return fx.rawResponder(sql, values);
      if (sql.includes('FROM "VideoView" v') && sql.includes("GROUP BY 1")) {
        return [{ day: new Date("2026-10-13T00:00:00.000Z"), n: BigInt(6) }, { day: new Date("2026-10-14T00:00:00.000Z"), n: BigInt(1) }];
      }
      if (sql.includes('FROM "VideoPlaybackSession" s') && sql.includes("AS day")) {
        return [{ day: new Date("2026-10-13T00:00:00.000Z"), sessions: BigInt(12), watch_ms: 600000, pct_n: BigInt(12), pct_sum: 6 }];
      }
      if (sql.includes("AS video_id")) {
        return [{ video_id: "vid-1", sessions: BigInt(12), watch_ms: 600000, pct_n: BigInt(12), pct_sum: 6 }];
      }
      if (sql.includes("AS bucket")) return [{ bucket: 20, n: BigInt(6) }, { bucket: 5, n: BigInt(6) }];
      if (sql.includes("AS signed_in")) return [{ views: BigInt(12), signed_in: BigInt(5), subscribers: BigInt(2) }];
      return [];
    }),
  };
  const ctx = createAppContext({ actor, prisma: prisma as never, channelId, now: () => NOW }) as AppContext;
  return { ctx, prisma, rawCalls };
}

const owner: Actor = { type: "user", userId: "user-a" };

describe("authorization", () => {
  it("lets the owner read the overview of their own channel", async () => {
    const { ctx } = build(owner, "ch-a");
    const r = await getChannelAnalyticsOverview(ctx, { range: "28" });
    expect(r.ok).toBe(true);
  });

  it("denies an owner of another channel (cross-channel attack) with 403 and runs no analytics query", async () => {
    const { ctx, prisma } = build(owner, "ch-b");
    const r = await getChannelAnalyticsOverview(ctx, { range: "28" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.statusCode).toBe(403);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.videoView.groupBy).not.toHaveBeenCalled();
  });

  it("denies a channel member whose role has no analytics permission (MODERATOR) and allows an EDITOR", async () => {
    const moderator = build({ type: "user", userId: "user-mod" }, "ch-team");
    const denied = await getChannelVideoAnalytics(moderator.ctx, { range: "7" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.statusCode).toBe(403);
    expect(moderator.prisma.video.findMany).not.toHaveBeenCalled();

    const editor = build({ type: "user", userId: "user-ed" }, "ch-team");
    expect((await getChannelVideoAnalytics(editor.ctx, { range: "7" })).ok).toBe(true);
  });

  it("answers 401 for a guest, 409 when the context has no channel and 404 for an unknown channel", async () => {
    const guest = await getChannelAnalyticsOverview(build({ type: "guest" }, "ch-a").ctx, {});
    expect(!guest.ok && guest.error.statusCode).toBe(401);
    const none = await getChannelAnalyticsOverview(build(owner, undefined).ctx, {});
    expect(!none.ok && none.error.statusCode).toBe(409);
    const missing = await getChannelAnalyticsOverview(build(owner, "ch-zzz").ctx, {});
    expect(!missing.ok && missing.error.statusCode).toBe(404);
  });

  it("refuses a suspended channel for its members (frozen)", async () => {
    const fx: Fixture = { channels: { "ch-a": { userId: "user-a", status: "SUSPENDED" } } };
    const r = await getChannelAnalyticsOverview(build(owner, "ch-a", fx).ctx, {});
    expect(!r.ok && r.error.statusCode).toBe(403);
  });

  it("rejects an unsupported range before touching data", async () => {
    const { ctx, prisma } = build(owner, "ch-a");
    const r = await getChannelAnalyticsOverview(ctx, { range: "365" });
    expect(!r.ok && r.error.code).toBe("BAD_RANGE");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("overview", () => {
  it("aggregates views, watch time, share watched, comments and the subscriber flow", async () => {
    const { ctx } = build(owner, "ch-a");
    const r = await getChannelAnalyticsOverview(ctx, { range: 7 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = r.data;
    expect(o.daily).toHaveLength(7);
    expect(o.totals.views).toBe(7);
    expect(o.totals.watchSeconds).toBe(600);
    expect(o.totals.avgPctViewed).toBe(50);
    expect(o.totals.comments).toBe(3);
    expect(o.subscribers).toMatchObject({ current: 120, baseline: 100, net: 20, gained: 12, lost: 0 });
    // snapshot of 13 Oct is shown, 14 Oct (today) is the live count, the days without a record are gaps
    expect(o.daily.find((d) => d.day === "2026-10-13")?.subscribers).toBe(118);
    expect(o.daily.find((d) => d.day === "2026-10-14")?.subscribers).toBe(120);
    expect(o.daily[0].subscribers).toBeNull();
    expect(o.freshness.generatedAt).toBe(NOW.toISOString());
    expect(o.freshness.subscribersSnapshotDay).toBe("2026-10-13");
  });

  it("returns zeros and withheld averages for a channel without any data, not errors", async () => {
    const { ctx } = build(owner, "ch-a", { rawResponder: () => [] });
    (ctx.prisma as never as { videoView: { groupBy: unknown } }).videoView.groupBy = vi.fn(async () => []);
    const r = await getChannelAnalyticsOverview(ctx, { range: "28" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.totals.views).toBe(0);
    expect(r.data.totals.watchSeconds).toBe(0);
    expect(r.data.totals.avgPctViewed).toBeNull();
    expect(r.data.totals.avgState).toBe("no_data");
    expect(r.data.daily).toHaveLength(28);
  });

  it("binds the channel id and the period start/end into every raw query (scope and period boundary)", async () => {
    const { ctx, rawCalls } = build(owner, "ch-a");
    await getChannelAnalyticsOverview(ctx, { range: "7" });
    expect(rawCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of rawCalls) {
      expect(call.sql).toContain('"creatorId" =');
      expect(call.values).toContain("ch-a");
      const dates = call.values.filter((v): v is Date => v instanceof Date).map((d) => d.toISOString());
      expect(dates).toContain("2026-10-08T00:00:00.000Z");
      expect(dates).toContain(NOW.toISOString());
    }
  });
});

describe("video list and detail", () => {
  it("lists the channel videos with their numbers and hides the average of a small sample", async () => {
    const { ctx } = build(owner, "ch-a");
    const r = await getChannelVideoAnalytics(ctx, { range: "28" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [first, second] = r.data.items;
    expect(first).toMatchObject({ id: "vid-1", views: 7, watchSeconds: 600, avgPctViewed: 50, comments: 2, likes: 4 });
    expect(second).toMatchObject({ id: "vid-2", views: 0, avgPctViewed: null, avgState: "no_data" });
    expect(r.data.truncated).toBe(false);
  });

  it("scopes the video lookup to the context channel: another channel's video is 404", async () => {
    const own = await getChannelVideoDetail(build(owner, "ch-a").ctx, { videoId: "vid-1", range: "28" });
    expect(own.ok).toBe(true);
    // user-b is authorized on ch-b but vid-1 belongs to ch-a
    const foreign = await getChannelVideoDetail(build({ type: "user", userId: "user-b" }, "ch-b").ctx, { videoId: "vid-1", range: "28" });
    expect(!foreign.ok && foreign.error.statusCode).toBe(404);
  });

  it("builds the reach curve and the viewer split from counts only", async () => {
    const { ctx } = build(owner, "ch-a");
    const r = await getChannelVideoDetail(ctx, { videoId: "vid-1", range: "28" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.retention.state).toBe("ok");
    expect(r.data.retention.points?.[0].reachedPct).toBe(100);
    expect(r.data.retention.points?.[20].reachedPct).toBe(50);
    expect(r.data.audience).toMatchObject({ state: "ok", guestViews: 7, signedInViews: 5, subscriberViews: 2 });
    // privacy: the response carries no user, session or ip fields anywhere
    expect(JSON.stringify(r.data)).not.toMatch(/userId|ipHash|sessionId|userAgent/i);
  });
});

describe("CSV export", () => {
  it("neutralizes spreadsheet formulas, escapes quotes and sets a safe filename", async () => {
    const { ctx } = build(owner, "ch-a");
    const r = await exportChannelAnalyticsCsv(ctx, { range: "28", kind: "videos" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lines = r.data.csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("title,slug,status,published_at,views,watch_seconds,avg_percent_viewed,comments,likes");
    // the title that starts with "=" gets a leading apostrophe and is quoted (it has quotes and a comma-free body)
    const formulaRow = lines.find((l) => l.includes("HYPERLINK"));
    expect(formulaRow).toBeDefined();
    expect(formulaRow!.startsWith("\"'=HYPERLINK(")).toBe(true);
    expect(formulaRow).toContain('""http://x""');
    expect(r.data.filename).toMatch(/^analytics-alpha-videos-28d-20261014\.csv$/);
    expect(r.data.csv.startsWith("﻿")).toBe(true);
  });

  it("exports the daily series with empty cells for days without a subscriber record", async () => {
    const { ctx } = build(owner, "ch-a");
    const r = await exportChannelAnalyticsCsv(ctx, { range: "7", kind: "daily" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lines = r.data.csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("day,views,watch_seconds,subscribers");
    expect(lines).toHaveLength(8);
    expect(lines[1]).toBe("2026-10-08,0,0,");
    expect(lines.at(-1)).toBe("2026-10-14,1,0,120");
  });

  it("is authorized like the screens and rejects unknown kinds and ranges", async () => {
    const denied = await exportChannelAnalyticsCsv(build(owner, "ch-b").ctx, { range: "28" });
    expect(!denied.ok && denied.error.statusCode).toBe(403);
    const kind = await exportChannelAnalyticsCsv(build(owner, "ch-a").ctx, { range: "28", kind: "users" });
    expect(!kind.ok && kind.error.code).toBe("BAD_KIND");
    const range = await exportChannelAnalyticsCsv(build(owner, "ch-a").ctx, { range: "5" });
    expect(!range.ok && range.error.code).toBe("BAD_RANGE");
  });
});
