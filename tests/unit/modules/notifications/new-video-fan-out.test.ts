import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import {
  FAN_OUT_PAGE_SIZE,
  createNewVideoFanOutHandler,
  notifyNewVideoPublished,
} from "@/lib/modules/notifications/application/new-video-fan-out.use-case";
import { DURABLE_JOB_LEASE_MS, runDurableJobs, type JobContext } from "@/lib/modules/shared/durable-job";
import { createMemoryJobStore } from "../shared/memory-job-store";

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
    premiereNotifiedAt: null as Date | null,
    creatorId: "c1",
    creator: { id: "c1", name: "Kanal", userId: "owner", status: "ACTIVE", deletedAt: null },
    ...overrides,
  };
}

/** A stateful fake database: users are paged by id (keyset), a transaction commits its rows only when it succeeds. */
function makeDb(opts: { video?: ReturnType<typeof makeVideo> | null; subscribers?: string[]; existing?: string[] } = {}) {
  const video = "video" in opts ? opts.video : makeVideo();
  const subscribers = [...(opts.subscribers ?? [])].sort();
  const created: Array<Record<string, unknown>> = (opts.existing ?? []).map((userId) => ({ userId, kind: "NEW_VIDEO", videoId: "v1" }));
  const subscriptionQueries: Array<Record<string, any>> = [];
  const db = {
    video: {
      findUnique: vi.fn(async () => video),
      updateMany: vi.fn(async ({ where, data }: { where: { premiereNotifiedAt: null }; data: { premiereNotifiedAt: Date } }) => {
        if (!video || video.premiereNotifiedAt !== null) return { count: 0 };
        video.premiereNotifiedAt = data.premiereNotifiedAt;
        return { count: where ? 1 : 0 };
      }),
    },
    notificationTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    subscription: {
      findMany: vi.fn(async (args: { where: { userId: { gt?: string } }; take: number }) => {
        subscriptionQueries.push(args as never);
        const gt = args.where.userId.gt;
        return subscribers.filter((id) => (gt === undefined ? true : id > gt)).slice(0, args.take).map((userId) => ({ userId }));
      }),
    },
    durableJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      const staged: Array<Record<string, unknown>> = [];
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        notification: {
          findMany: vi.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
            created.filter((n) => where.userId.in.includes(n.userId as string)).map((n) => ({ userId: n.userId })),
          ),
          createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            staged.push(...data);
            return { count: data.length };
          }),
        },
      };
      const result = await fn(tx);
      created.push(...staged); // commit
      return result;
    }),
  };
  return { db: db as never, raw: db, created, video, subscriptionQueries };
}

async function setup(opts: Parameters<typeof makeDb>[0] = {}, payload: unknown = { variant: "publish" }) {
  const fake = makeDb(opts);
  const store = createMemoryJobStore();
  await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload });
  const handler = createNewVideoFanOutHandler({ db: fake.db, now: () => NOW });
  const run = () => runDurableJobs({ store, handlers: { NEW_VIDEO_FANOUT: handler }, now: () => store.clock.now });
  return { ...fake, store, handler, run };
}

const users = (n: number) => Array.from({ length: n }, (_, i) => `u${String(i).padStart(5, "0")}`);

describe("new video fan-out job", () => {
  it("creates one NEW_VIDEO notification per subscriber with channel and video ids, marks the video announced and finishes the job", async () => {
    const t = await setup({ subscribers: ["u1", "u2"] });
    expect(await t.run()).toMatchObject({ done: 1 });
    const rows = t.created.filter((n) => n.kind === "NEW_VIDEO" && n.titlePl);
    expect(rows.map((n) => n.userId)).toEqual(["u1", "u2"]);
    expect(rows[0]).toMatchObject({ kind: "NEW_VIDEO", channelId: "c1", videoId: "v1", templateKey: "new_video" });
    expect(String(rows[0].href)).toContain("film");
    expect(t.video!.premiereNotifiedAt).toEqual(NOW);
    expect(t.store.jobs[0].status).toBe("DONE");
  });

  it("asks only for notify=true subscribers with newVideoInApp on, excluding the channel owner", async () => {
    const t = await setup({ subscribers: ["u1"] });
    await t.run();
    const where = t.raw.subscription.findMany.mock.calls[0][0].where as Record<string, any>;
    expect(where).toMatchObject({ creatorId: "c1", notify: true, userId: { not: "owner" } });
    expect(JSON.stringify(where.user)).toContain("newVideoInApp");
  });

  it("does nothing when nobody follows the channel, but still finishes", async () => {
    const t = await setup({ subscribers: [] });
    expect(await t.run()).toMatchObject({ done: 1 });
    expect(t.raw.$transaction).not.toHaveBeenCalled();
    expect(t.created).toHaveLength(0);
  });

  it("is idempotent per user and video: people who already have the notification are skipped", async () => {
    const t = await setup({ subscribers: ["u1", "u2", "u3"], existing: ["u1", "u3"] });
    await t.run();
    expect(t.created.filter((n) => n.titlePl).map((n) => n.userId)).toEqual(["u2"]);
  });

  it("reads and writes the audience in pages of FAN_OUT_PAGE_SIZE, one short transaction each, never the whole audience at once", async () => {
    const t = await setup({ subscribers: users(FAN_OUT_PAGE_SIZE * 2 + 200) });
    await t.run();
    expect(t.raw.$transaction).toHaveBeenCalledTimes(3);
    expect(t.subscriptionQueries.every((q) => q.take === FAN_OUT_PAGE_SIZE)).toBe(true);
    expect(t.subscriptionQueries.map((q) => q.where.userId.gt)).toEqual([undefined, `u${String(FAN_OUT_PAGE_SIZE - 1).padStart(5, "0")}`, `u${String(FAN_OUT_PAGE_SIZE * 2 - 1).padStart(5, "0")}`]);
    expect(t.created.filter((n) => n.titlePl)).toHaveLength(FAN_OUT_PAGE_SIZE * 2 + 200);
  });

  it("resumes after a crash in the middle: the page in flight is rolled back, the next run continues after the saved cursor, nobody gets two", async () => {
    const total = FAN_OUT_PAGE_SIZE * 2 + 50;
    const t = await setup({ subscribers: users(total) });
    // The process dies while saving the checkpoint of page 2 (the transaction of that page never commits).
    const realCheckpoint = t.store.checkpoint.bind(t.store);
    let calls = 0;
    t.store.checkpoint = async (...args) => {
      if (++calls === 2) throw new Error("process killed");
      return realCheckpoint(...args);
    };
    const first = await t.run();
    expect(first).toMatchObject({ retried: 1, done: 0 });
    expect(t.created.filter((n) => n.titlePl)).toHaveLength(FAN_OUT_PAGE_SIZE); // only page 1 is committed
    expect(t.store.jobs[0].cursor).toBe(`u${String(FAN_OUT_PAGE_SIZE - 1).padStart(5, "0")}`);
    expect(t.video!.premiereNotifiedAt).toBeNull(); // not "announced" until the last page is written

    t.store.clock.now = t.store.jobs[0].runAfter; // backoff passed
    expect(await t.run()).toMatchObject({ done: 1 });
    const ids = t.created.filter((n) => n.titlePl).map((n) => n.userId as string);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    expect(t.video!.premiereNotifiedAt).toEqual(NOW);
  });

  it("a run whose lease expired and was taken over writes nothing more (its page is rolled back)", async () => {
    const t = await setup({ subscribers: users(FAN_OUT_PAGE_SIZE + 10) });
    const realCheckpoint = t.store.checkpoint.bind(t.store);
    let calls = 0;
    t.store.checkpoint = async (job, ...rest) => {
      // Before page 2 another worker takes the job over (the token changes).
      if (++calls === 2) t.store.jobs[0].lockedBy = "token-other";
      return realCheckpoint(job, ...rest);
    };
    const result = await t.run();
    expect(result).toMatchObject({ leaseLost: 1, done: 0 });
    expect(t.created.filter((n) => n.titlePl)).toHaveLength(FAN_OUT_PAGE_SIZE);
    expect(t.video!.premiereNotifiedAt).toBeNull();
    expect(t.store.jobs[0]).toMatchObject({ status: "PENDING", lockedBy: "token-other" });
  });

  it("another worker takes over an abandoned job after the lease and finishes only what is left", async () => {
    const t = await setup({ subscribers: users(FAN_OUT_PAGE_SIZE + 5) });
    // Worker A: commits page 1 through the real handler path, then vanishes holding the lease.
    const claimed = (await t.store.claimNext(["NEW_VIDEO_FANOUT"], DURABLE_JOB_LEASE_MS, "token-A"))!;
    let yielded = false;
    const ctx: JobContext = {
      job: claimed,
      shouldYield: () => (yielded = true),
      checkpoint: async (cursor) => {
        await t.store.checkpoint(claimed, cursor, DURABLE_JOB_LEASE_MS);
      },
    };
    expect(await t.handler(ctx)).toBe("continue");
    expect(yielded).toBe(true);
    expect(t.created.filter((n) => n.titlePl)).toHaveLength(FAN_OUT_PAGE_SIZE);

    expect((await t.run()).claimed).toBe(0); // lease still held by A
    t.store.clock.now += DURABLE_JOB_LEASE_MS + 1;
    expect(await t.run()).toMatchObject({ done: 1 });
    expect(t.created.filter((n) => n.titlePl)).toHaveLength(FAN_OUT_PAGE_SIZE + 5);
    expect(new Set(t.created.filter((n) => n.titlePl).map((n) => n.userId)).size).toBe(FAN_OUT_PAGE_SIZE + 5);
  });

  it("running the same job again after it finished (re-publication) sends nothing twice but reaches new followers", async () => {
    const t = await setup({ subscribers: ["u1", "u2"] });
    await t.run();
    expect(t.created.filter((n) => n.titlePl)).toHaveLength(2);
    t.raw.subscription.findMany.mockImplementation(async () => [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }]);
    await t.store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: { variant: "publish" }, reopen: ["DONE", "DEAD"] });
    await t.run();
    expect(t.created.filter((n) => n.titlePl).map((n) => n.userId)).toEqual(["u1", "u2", "u3"]);
  });

  it("the premiere variant sends the premiere texts", async () => {
    const t = await setup({ subscribers: ["u1"], video: makeVideo({ premiereAt: new Date("2026-10-14T11:59:00Z") }) }, { variant: "premiere" });
    await t.run();
    expect(t.created.find((n) => n.titlePl)).toMatchObject({ titlePl: "Premiera: Film", titleEn: "Premiere: Movie", templateKey: "premiere" });
  });

  it.each([
    ["UNLISTED", { status: "UNLISTED" }],
    ["DRAFT", { status: "DRAFT" }],
    ["ARCHIVED", { status: "ARCHIVED" }],
    ["upcoming premiere", { premiereAt: new Date("2026-11-01T00:00:00Z") }],
    ["limited by moderation", { moderationStatus: "LIMITED" }],
  ])("skips %s: the job finishes without reading the audience and without marking the video", async (_name, overrides) => {
    const t = await setup({ video: makeVideo(overrides), subscribers: ["u1"] });
    expect(await t.run()).toMatchObject({ done: 1 });
    expect(t.raw.subscription.findMany).not.toHaveBeenCalled();
    expect(t.video!.premiereNotifiedAt).toBeNull();
  });

  it("finishes without sending when the video is gone", async () => {
    const t = await setup({ video: null, subscribers: ["u1"] });
    expect(await t.run()).toMatchObject({ done: 1 });
    expect(t.created).toHaveLength(0);
  });
});

describe("notifyNewVideoPublished", () => {
  it("enqueues one durable job (reopening a finished one) and starts a runner; it does not deliver in the request", async () => {
    const { db, raw } = makeDb({ subscribers: ["u1"] });
    const kick = vi.fn();
    const result = await notifyNewVideoPublished("v1", { db, now: () => NOW, kick });
    expect(result).toEqual({ status: "queued" });
    expect(raw.durableJob.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true, data: [expect.objectContaining({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: { variant: "publish" } })] }));
    expect(raw.durableJob.updateMany.mock.calls[0][0].where).toMatchObject({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", status: { in: ["DONE", "DEAD"] } });
    expect(kick).toHaveBeenCalledTimes(1);
    expect(raw.subscription.findMany).not.toHaveBeenCalled();
    expect(raw.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["UNLISTED", { status: "UNLISTED" }, "NOT_PUBLISHED"],
    ["DRAFT", { status: "DRAFT" }, "NOT_PUBLISHED"],
    ["upcoming premiere", { premiereAt: new Date("2026-11-01T00:00:00Z") }, "UPCOMING_PREMIERE"],
    ["limited by moderation", { moderationStatus: "LIMITED" }, "NOT_VISIBLE"],
  ])("skips %s without enqueueing (a scheduled premiere is enqueued by the cron when it starts)", async (_name, overrides, reason) => {
    const { db, raw } = makeDb({ video: makeVideo(overrides) });
    const kick = vi.fn();
    expect(await notifyNewVideoPublished("v1", { db, now: () => NOW, kick })).toEqual({ status: "skipped", reason });
    expect(raw.durableJob.createMany).not.toHaveBeenCalled();
    expect(kick).not.toHaveBeenCalled();
  });

  it("skips a missing video", async () => {
    const { db } = makeDb({ video: null });
    expect(await notifyNewVideoPublished("nope", { db, now: () => NOW, kick: vi.fn() })).toEqual({ status: "skipped", reason: "NOT_FOUND" });
  });

  it("announces a video whose past premiere already started", async () => {
    const { db } = makeDb({ video: makeVideo({ premiereAt: new Date("2026-10-14T10:00:00Z") }) });
    expect(await notifyNewVideoPublished("v1", { db, now: () => NOW, kick: vi.fn() })).toEqual({ status: "queued" });
  });

  it("never throws: a database failure becomes an error status and starts nothing", async () => {
    const { db, raw } = makeDb({ subscribers: ["u1"] });
    raw.durableJob.createMany.mockRejectedValueOnce(new Error("db down"));
    const kick = vi.fn();
    await expect(notifyNewVideoPublished("v1", { db, now: () => NOW, kick })).resolves.toEqual({ status: "error" });
    expect(kick).not.toHaveBeenCalled();
  });
});
