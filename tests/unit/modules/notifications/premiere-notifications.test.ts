import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { notifyDuePremieres } from "@/lib/modules/notifications/application/premiere-notifications.use-case";
import { createNewVideoFanOutHandler, notifyNewVideoPublished } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";
import { buildPremiereCopy } from "@/lib/modules/notifications/domain/new-video";
import { DURABLE_JOB_LEASE_MS, runDurableJobs } from "@/lib/modules/shared/durable-job";
import { createMemoryJobStore } from "../shared/memory-job-store";

const NOW = new Date("2026-10-19T12:00:00Z");

type V = {
  id: string;
  title: string;
  titleEn: string | null;
  slug: string;
  status: string;
  premiereAt: Date | null;
  publishedAt: Date | null;
  moderationStatus: string;
  premiereNotifiedAt: Date | null;
  creator: { id: string; name: string; userId: string; status: string; deletedAt: Date | null };
};

function video(over: Partial<V> = {}): V {
  return {
    id: "v1",
    title: "Premiera filmu",
    titleEn: "Film premiere",
    slug: "film",
    status: "PUBLISHED",
    premiereAt: new Date("2026-10-19T11:59:00Z"),
    publishedAt: new Date("2026-10-10T10:00:00Z"),
    moderationStatus: "VISIBLE",
    premiereNotifiedAt: null,
    creator: { id: "c1", name: "Kanal", userId: "owner", status: "ACTIVE", deletedAt: null },
    ...over,
  };
}

/**
 * A small stateful fake: findMany evaluates the where-clause fields the use case filters on, the durable job
 * table is the in-memory store, a transaction commits its rows only when it succeeds.
 */
function makeDb(videos: V[], subscribers: string[] = ["u1", "u2"]) {
  const created: Array<Record<string, unknown>> = [];
  const store = createMemoryJobStore();
  const matches = (v: V, where: any): boolean => {
    if (where.status && v.status !== where.status) return false;
    if (where.id?.notIn?.includes(v.id)) return false;
    if (where.premiereAt && (v.premiereAt === null || v.premiereAt > where.premiereAt.lte)) return false;
    if (where.premiereNotifiedAt === null && v.premiereNotifiedAt !== null) return false;
    if (where.moderationStatus && !where.moderationStatus.in.includes(v.moderationStatus)) return false;
    if (where.creator && (v.creator.deletedAt !== null || !where.creator.status.in.includes(v.creator.status))) return false;
    return true;
  };
  const db = {
    video: {
      findMany: vi.fn(async ({ where, take }: { where: any; take: number }) => videos.filter((v) => matches(v, where)).slice(0, take)),
      updateMany: vi.fn(async ({ where, data }: { where: any; data: { premiereNotifiedAt: Date } }) => {
        const v = videos.find((x) => x.id === where.id);
        if (!v || v.premiereNotifiedAt !== null) return { count: 0 };
        v.premiereNotifiedAt = data.premiereNotifiedAt;
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => videos.find((v) => v.id === where.id) ?? null),
    },
    notificationTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    subscription: { findMany: vi.fn(async (_args?: unknown) => subscribers.map((userId) => ({ userId }))) },
    // DurableJobRepository.enqueue = createMany(skipDuplicates) + conditional updateMany; both land in the in-memory store.
    durableJob: {
      findMany: vi.fn(async ({ where, take }: { where: { kind: string; status: string }; take: number }) =>
        store.jobs.filter((j) => j.kind === where.kind && j.status === where.status).slice(0, take).map((j) => ({ dedupeKey: j.dedupeKey })),
      ),
      createMany: vi.fn(async ({ data }: { data: Array<{ kind: string; dedupeKey: string; payload: unknown }> }) => {
        for (const d of data) await store.enqueue({ kind: d.kind as "NEW_VIDEO_FANOUT", dedupeKey: d.dedupeKey, payload: d.payload });
        return { count: data.length };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { kind: string; dedupeKey: string; status: { in: string[] } }; data: { payload: unknown } }) => {
        const job = store.jobs.find((j) => j.kind === where.kind && j.dedupeKey === where.dedupeKey);
        if (!job || !where.status.in.includes(job.status)) return { count: 0 };
        await store.enqueue({ kind: job.kind as "NEW_VIDEO_FANOUT", dedupeKey: job.dedupeKey, payload: data.payload, reopen: ["DONE", "DEAD"] });
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
      const staged: Array<Record<string, unknown>> = [];
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        video: { findUnique: async ({ where }: { where: { id: string } }) => videos.find((v) => v.id === where.id) ?? null },
        notification: {
          findMany: vi.fn(async ({ where }: { where: { videoId: string; userId: { in: string[] } } }) =>
            created.filter((n) => n.videoId === where.videoId && where.userId.in.includes(n.userId as string)).map((n) => ({ userId: n.userId })),
          ),
          createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            staged.push(...data);
            return { count: data.length };
          }),
        },
      };
      const result = await fn(tx);
      created.push(...staged);
      return result;
    }),
  };
  const runJobs = (now: () => Date = () => NOW) =>
    runDurableJobs({ store, handlers: { NEW_VIDEO_FANOUT: createNewVideoFanOutHandler({ db: db as never, now }) }, now: () => store.clock.now });
  return { db: db as never, raw: db, created, store, runJobs };
}

describe("notifyDuePremieres and DEAD jobs (W22)", () => {
  it("does not let dead premieres fill the batch forever: newer premieres still reach the queue", async () => {
    const early = (id: string, minute: number) => video({ id, slug: id, premiereAt: new Date(`2026-10-19T11:0${minute}:00Z`) });
    const videos = [early("old1", 1), early("old2", 2), early("fresh", 5)];
    const { db, store } = makeDb(videos);
    // The two oldest premieres ran into a broken transport and ended DEAD.
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "old1", payload: { variant: "premiere" } });
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "old2", payload: { variant: "premiere" } });
    store.jobs.forEach((j) => (j.status = "DEAD"));

    const result = await notifyDuePremieres({ db, now: () => NOW, batchSize: 2 });
    expect(result).toEqual({ candidates: 1, enqueued: 1, failed: 0 });
    expect(store.jobs.find((j) => j.dedupeKey === "fresh")).toMatchObject({ status: "PENDING" });
    expect(store.jobs.filter((j) => j.status === "DEAD").map((j) => j.dedupeKey).sort()).toEqual(["old1", "old2"]);
  });
});

describe("notifyDuePremieres", () => {
  it("puts a premiere that started in the durable queue; the job then sends the premiere texts and marks the video", async () => {
    const v = video();
    const { db, created, store, runJobs } = makeDb([v]);
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result).toEqual({ candidates: 1, enqueued: 1, failed: 0 });
    expect(store.jobs).toMatchObject([{ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", status: "PENDING", payload: { variant: "premiere" } }]);
    expect(created).toHaveLength(0); // the cron tick only enqueues; delivery is the job's work
    expect(v.premiereNotifiedAt).toBeNull();

    await runJobs();
    expect(created.map((n) => n.userId)).toEqual(["u1", "u2"]);
    expect(created[0]).toMatchObject({
      kind: "NEW_VIDEO",
      channelId: "c1",
      videoId: "v1",
      titlePl: "Premiera: Premiera filmu",
      titleEn: "Premiere: Film premiere",
      bodyPl: "Film właśnie się zaczął na kanale Kanal",
      bodyEn: "The video just premiered on Kanal",
    });
    expect(String(created[0].href)).toContain("film");
    expect(v.premiereNotifiedAt).toEqual(NOW);
    expect(store.jobs[0].status).toBe("DONE");
  });

  it("is idempotent: repeated and overlapping ticks queue one job and send once", async () => {
    const { db, created, store, runJobs } = makeDb([video()]);
    await notifyDuePremieres({ db, now: () => NOW });
    await notifyDuePremieres({ db, now: () => NOW });
    expect(store.jobs).toHaveLength(1);
    await Promise.all([runJobs(), runJobs()]);
    await notifyDuePremieres({ db, now: () => NOW }); // after completion the video is no longer a candidate
    await runJobs();
    expect(created).toHaveLength(2);
  });

  it("a process that dies half-way no longer strands the video: the unfinished job is taken over after its lease and finished", async () => {
    const v = video();
    const { db, created, store, runJobs } = makeDb([v]);
    await notifyDuePremieres({ db, now: () => NOW });
    // A worker takes the job and dies before sending anything (previously: premiereNotifiedAt stayed set forever).
    await store.claimNext(["NEW_VIDEO_FANOUT"], DURABLE_JOB_LEASE_MS, "token-dead");
    expect(v.premiereNotifiedAt).toBeNull();
    expect((await runJobs()).claimed).toBe(0);
    store.clock.now += DURABLE_JOB_LEASE_MS + 1;
    expect(await runJobs()).toMatchObject({ done: 1 });
    expect(created).toHaveLength(2);
    expect(v.premiereNotifiedAt).toEqual(NOW);
  });

  it("a candidate stays a candidate until its job finished, and a skipped (finished) job is opened again", async () => {
    const v = video({ moderationStatus: "VISIBLE" });
    const { db, store } = makeDb([v]);
    await notifyDuePremieres({ db, now: () => NOW });
    expect((await notifyDuePremieres({ db, now: () => NOW })).candidates).toBe(1); // still due, job still pending
    store.jobs[0].status = "DONE"; // e.g. it ran while the video was momentarily hidden and finished without sending
    await notifyDuePremieres({ db, now: () => NOW });
    expect(store.jobs[0].status).toBe("PENDING");
    store.jobs[0].status = "DEAD"; // an operator's decision: the cron does not keep retrying a dead job
    await notifyDuePremieres({ db, now: () => NOW });
    expect(store.jobs[0].status).toBe("DEAD");
  });

  it("skips ineligible videos: future premiere, no premiere, UNLISTED/DRAFT/ARCHIVED, removed, hidden channel, already notified", async () => {
    const videos = [
      video({ id: "future", premiereAt: new Date("2026-10-19T12:30:00Z") }),
      video({ id: "none", premiereAt: null }),
      video({ id: "unlisted", status: "UNLISTED" }),
      video({ id: "draft", status: "DRAFT" }),
      video({ id: "archived", status: "ARCHIVED" }),
      video({ id: "removed", moderationStatus: "REMOVED" }),
      video({ id: "limited-mod", moderationStatus: "LIMITED" }),
      video({ id: "deleted-channel", creator: { id: "c2", name: "X", userId: "o2", status: "ACTIVE", deletedAt: new Date() } }),
      video({ id: "suspended-channel", creator: { id: "c3", name: "X", userId: "o3", status: "SUSPENDED", deletedAt: null } }),
      video({ id: "done", premiereNotifiedAt: new Date("2026-10-19T11:59:30Z") }),
    ];
    const { db, store } = makeDb(videos);
    expect(await notifyDuePremieres({ db, now: () => NOW })).toEqual({ candidates: 0, enqueued: 0, failed: 0 });
    expect(store.jobs).toHaveLength(0);
  });

  it("respects the newVideoInApp preference and excludes the channel owner in the audience query", async () => {
    const { db, raw, runJobs } = makeDb([video()], ["u1"]);
    await notifyDuePremieres({ db, now: () => NOW });
    await runJobs();
    const where = raw.subscription.findMany.mock.calls[0][0] as any;
    expect(where.where).toMatchObject({ creatorId: "c1", notify: true, userId: { not: "owner" } });
    expect(JSON.stringify(where.where.user)).toContain("newVideoInApp");
  });

  it("is bounded by the batch size", async () => {
    const videos = [video({ id: "a" }), video({ id: "b" }), video({ id: "c" })];
    const { db, raw } = makeDb(videos);
    const result = await notifyDuePremieres({ db, now: () => NOW, batchSize: 2 });
    expect(raw.video.findMany.mock.calls[0][0].take).toBe(2);
    expect(result.candidates).toBe(2);
  });

  it("one failing enqueue does not stop the others", async () => {
    const { db, raw, store } = makeDb([video({ id: "a" }), video({ id: "b" })]);
    raw.durableJob.createMany.mockRejectedValueOnce(new Error("db hiccup"));
    expect(await notifyDuePremieres({ db, now: () => NOW })).toEqual({ candidates: 2, enqueued: 1, failed: 1 });
    expect(store.jobs.map((j) => j.dedupeKey)).toEqual(["b"]);
    expect(await notifyDuePremieres({ db, now: () => NOW })).toMatchObject({ enqueued: 2 }); // next tick picks "a" up
    expect(store.jobs.map((j) => j.dedupeKey).sort()).toEqual(["a", "b"]);
  });
});

describe("premiere cron and publish path never double-send", () => {
  it("a video announced at publish time is not announced again by the cron", async () => {
    const v = video({ premiereAt: null });
    const { db, created, store, runJobs } = makeDb([v]);
    expect(await notifyNewVideoPublished("v1", { db, now: () => NOW, kick: vi.fn() })).toEqual({ status: "queued" });
    expect(store.jobs).toHaveLength(1);
    await runJobs();
    expect(v.premiereNotifiedAt).toEqual(NOW);
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result.candidates).toBe(0);
    expect(created).toHaveLength(2);
  });

  it("an upcoming premiere is skipped at publish time and sent once by the cron when it starts", async () => {
    const v = video({ premiereAt: new Date("2026-10-19T13:00:00Z") });
    const { db, created, store, runJobs } = makeDb([v]);
    expect(await notifyNewVideoPublished("v1", { db, now: () => NOW, kick: vi.fn() })).toEqual({ status: "skipped", reason: "UPCOMING_PREMIERE" });
    expect(store.jobs).toHaveLength(0);
    expect((await notifyDuePremieres({ db, now: () => NOW })).candidates).toBe(0);
    const later = () => new Date("2026-10-19T13:00:30Z");
    expect(await notifyDuePremieres({ db, now: later })).toMatchObject({ enqueued: 1 });
    await runJobs(later);
    await notifyDuePremieres({ db, now: later });
    await runJobs(later);
    expect(created).toHaveLength(2);
  });

  it("a publish job and a premiere tick for the same video share one job, so the audience is written once", async () => {
    const v = video({ premiereAt: new Date("2026-10-19T11:00:00Z") }); // premiere already passed
    const { db, created, store, runJobs } = makeDb([v]);
    await notifyNewVideoPublished("v1", { db, now: () => NOW, kick: vi.fn() });
    await notifyDuePremieres({ db, now: () => NOW }); // the cron ticks before the publish job ran
    expect(store.jobs).toHaveLength(1);
    await runJobs();
    expect(created).toHaveLength(2);
  });

  it("a premiere rescheduled later before it fired stays armed; after it fired it is not re-sent", async () => {
    const v = video({ premiereAt: new Date("2026-10-19T13:00:00Z") });
    const { db, created, runJobs } = makeDb([v]);
    v.premiereAt = new Date("2026-10-19T14:00:00Z");
    expect((await notifyDuePremieres({ db, now: () => new Date("2026-10-19T13:30:00Z") })).candidates).toBe(0);
    const t = () => new Date("2026-10-19T14:00:01Z");
    expect(await notifyDuePremieres({ db, now: t })).toMatchObject({ enqueued: 1 });
    await runJobs(t);
    v.premiereAt = new Date("2026-10-19T14:10:00Z");
    expect((await notifyDuePremieres({ db, now: () => new Date("2026-10-19T14:30:00Z") })).candidates).toBe(0);
    expect(created).toHaveLength(2);
  });
});

describe("buildPremiereCopy", () => {
  it("falls back to the Polish title for English and clips long text", () => {
    const copy = buildPremiereCopy({ channelName: "K", title: "T".repeat(300), titleEn: "" });
    expect(copy.titleEn.startsWith("Premiere: TTT")).toBe(true);
    expect(copy.titleEn.length).toBeLessThanOrEqual("Premiere: ".length + 200);
    expect(copy.bodyEn).toBe("The video just premiered on K");
  });
});
