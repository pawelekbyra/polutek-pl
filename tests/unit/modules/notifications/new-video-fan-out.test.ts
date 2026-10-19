import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { fanOutNewVideo, notifyNewVideoPublished } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";

const NOW = new Date("2026-10-14T12:00:00Z");

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    title: "Film",
    titleEn: "Movie",
    slug: "film",
    status: "PUBLISHED",
    premiereAt: null,
    publishedAt: new Date("2026-10-14T11:00:00Z"),
    moderationStatus: "VISIBLE",
    creatorId: "c1",
    creator: { id: "c1", name: "Kanal", userId: "owner", status: "ACTIVE", deletedAt: null },
    ...overrides,
  };
}

function makeDb(opts: { video?: unknown; subscribers?: string[]; existing?: string[] } = {}) {
  const created: Array<Record<string, unknown>> = [];
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    notification: {
      findMany: vi.fn().mockResolvedValue((opts.existing ?? []).map((userId) => ({ userId }))),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        created.push(...data);
        return { count: data.length };
      }),
    },
  };
  const db = {
    video: { findUnique: vi.fn().mockResolvedValue("video" in opts ? opts.video : makeVideo()), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    notificationTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    subscription: { findMany: vi.fn().mockResolvedValue((opts.subscribers ?? []).map((userId) => ({ userId }))) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { db: db as never, raw: db, tx, created };
}

describe("fanOutNewVideo", () => {
  it("creates one NEW_VIDEO notification per subscriber with channel and video ids", async () => {
    const { db, created } = makeDb({ subscribers: ["u1", "u2"] });
    const result = await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(result).toEqual({ status: "done", inApp: 2 });
    expect(created.map((n) => n.userId)).toEqual(["u1", "u2"]);
    expect(created[0]).toMatchObject({ kind: "NEW_VIDEO", channelId: "c1", videoId: "v1" });
    expect(String(created[0].href)).toContain("film");
  });

  it("asks only for notify=true subscribers with newVideoInApp on, excluding the channel owner", async () => {
    const { db, raw } = makeDb({ subscribers: ["u1"] });
    await fanOutNewVideo("v1", { db, now: () => NOW });
    const where = raw.subscription.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ creatorId: "c1", notify: true, userId: { not: "owner" } });
    expect(JSON.stringify(where.user)).toContain("newVideoInApp");
  });

  it("does nothing when nobody follows the channel", async () => {
    const { db, raw, created } = makeDb({ subscribers: [] });
    const result = await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(result).toEqual({ status: "done", inApp: 0 });
    expect(raw.$transaction).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("is idempotent per user and video", async () => {
    const { db, created } = makeDb({ subscribers: ["u1", "u2", "u3"], existing: ["u1", "u3"] });
    const result = await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(result).toEqual({ status: "done", inApp: 1 });
    expect(created.map((n) => n.userId)).toEqual(["u2"]);
  });

  it("writes in batches, not one row per query", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => `u${i}`);
    const { db, tx } = makeDb({ subscribers: many });
    const result = await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(result).toEqual({ status: "done", inApp: 2500 });
    expect(tx.notification.createMany).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["UNLISTED", { status: "UNLISTED" }, "NOT_PUBLISHED"],
    ["DRAFT", { status: "DRAFT" }, "NOT_PUBLISHED"],
    ["ARCHIVED", { status: "ARCHIVED" }, "NOT_PUBLISHED"],
    ["upcoming premiere", { premiereAt: new Date("2026-11-01T00:00:00Z") }, "UPCOMING_PREMIERE"],
    ["limited by moderation", { moderationStatus: "LIMITED" }, "NOT_VISIBLE"],
  ])("skips %s", async (_name, overrides, reason) => {
    const { db, raw } = makeDb({ video: makeVideo(overrides), subscribers: ["u1"] });
    const result = await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(result).toEqual({ status: "skipped", reason });
    expect(raw.subscription.findMany).not.toHaveBeenCalled();
  });

  it("skips a missing video", async () => {
    const { db } = makeDb({ video: null });
    expect(await fanOutNewVideo("nope", { db, now: () => NOW })).toEqual({ status: "skipped", reason: "NOT_FOUND" });
  });

  it("announces a video whose past premiere already started", async () => {
    const { db } = makeDb({ video: makeVideo({ premiereAt: new Date("2026-10-14T10:00:00Z") }), subscribers: ["u1"] });
    expect(await fanOutNewVideo("v1", { db, now: () => NOW })).toEqual({ status: "done", inApp: 1 });
  });
});

describe("notifyNewVideoPublished", () => {
  it("never throws: a database failure becomes an error status", async () => {
    const { db, raw } = makeDb({ subscribers: ["u1"] });
    raw.$transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(notifyNewVideoPublished("v1", { db, now: () => NOW })).resolves.toEqual({ status: "error" });
  });
});

describe("publish-time fan-out and premiereNotifiedAt", () => {
  it("marks the video as announced (only while still null) so the premiere cron skips it", async () => {
    const { db, raw } = makeDb({ subscribers: ["u1"] });
    await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(raw.video.updateMany).toHaveBeenCalledWith({ where: { id: "v1", premiereNotifiedAt: null }, data: { premiereNotifiedAt: NOW } });
  });

  it("does not mark an upcoming premiere (the cron announces it later)", async () => {
    const { db, raw } = makeDb({ video: makeVideo({ premiereAt: new Date("2026-10-20T10:00:00Z") }), subscribers: ["u1"] });
    expect(await fanOutNewVideo("v1", { db, now: () => NOW })).toEqual({ status: "skipped", reason: "UPCOMING_PREMIERE" });
    expect(raw.video.updateMany).not.toHaveBeenCalled();
  });

  it("a failing mark does not fail the already delivered fan-out", async () => {
    const { db, raw } = makeDb({ subscribers: ["u1"] });
    raw.video.updateMany.mockRejectedValueOnce(new Error("db"));
    await expect(fanOutNewVideo("v1", { db, now: () => NOW })).resolves.toEqual({ status: "done", inApp: 1 });
  });
});
