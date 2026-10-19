import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { notifyDuePremieres } from "@/lib/modules/notifications/application/premiere-notifications.use-case";
import { fanOutNewVideo } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";
import { buildPremiereCopy } from "@/lib/modules/notifications/domain/new-video";

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

/** A small stateful fake: findMany evaluates the where-clause fields the use case filters on. */
function makeDb(videos: V[], subscribers: string[] = ["u1", "u2"]) {
  const created: Array<Record<string, unknown>> = [];
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    notification: {
      findMany: vi.fn(async ({ where }: { where: { videoId: string } }) =>
        created.filter((n) => n.videoId === where.videoId).map((n) => ({ userId: n.userId })),
      ),
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        created.push(...data);
        return { count: data.length };
      }),
    },
  };
  const matches = (v: V, where: any): boolean => {
    if (where.status && v.status !== where.status) return false;
    if (where.premiereAt && (v.premiereAt === null || v.premiereAt > where.premiereAt.lte)) return false;
    if (where.premiereNotifiedAt === null && v.premiereNotifiedAt !== null) return false;
    if (where.moderationStatus && !where.moderationStatus.in.includes(v.moderationStatus)) return false;
    if (where.creator && (v.creator.deletedAt !== null || !where.creator.status.in.includes(v.creator.status))) return false;
    return true;
  };
  const db = {
    video: {
      findMany: vi.fn(async ({ where, take }: { where: any; take: number }) => videos.filter((v) => matches(v, where)).slice(0, take)),
      updateMany: vi.fn(async ({ where, data }: { where: any; data: { premiereNotifiedAt: Date | null } }) => {
        const v = videos.find((x) => x.id === where.id);
        if (!v || (where.status && v.status !== where.status)) return { count: 0 };
        if ("premiereNotifiedAt" in where) {
          const expected = where.premiereNotifiedAt;
          if (expected === null ? v.premiereNotifiedAt !== null : v.premiereNotifiedAt?.getTime() !== expected.getTime()) return { count: 0 };
        }
        v.premiereNotifiedAt = data.premiereNotifiedAt;
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => videos.find((v) => v.id === where.id) ?? null),
    },
    notificationTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    subscription: { findMany: vi.fn().mockResolvedValue(subscribers.map((userId) => ({ userId }))) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { db: db as never, raw: db, tx, created };
}

describe("notifyDuePremieres", () => {
  it("announces a premiere that started, with premiere texts and the watch link", async () => {
    const v = video();
    const { db, created } = makeDb([v]);
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result).toEqual({ candidates: 1, claimed: 1, notifications: 2, failed: 0 });
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
  });

  it("claims atomically: a lost claim race sends nothing", async () => {
    const { db, raw, created } = makeDb([video()]);
    raw.video.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result).toMatchObject({ candidates: 1, claimed: 0, notifications: 0 });
    expect(created).toHaveLength(0);
    expect(raw.video.updateMany.mock.calls[0][0].where).toMatchObject({ id: "v1", premiereNotifiedAt: null });
  });

  it("is idempotent: two sequential and two concurrent runs send once", async () => {
    const { db, created } = makeDb([video()]);
    await notifyDuePremieres({ db, now: () => NOW });
    await notifyDuePremieres({ db, now: () => NOW });
    expect(created).toHaveLength(2);

    const second = makeDb([video()]);
    const [a, b] = await Promise.all([
      notifyDuePremieres({ db: second.db, now: () => NOW }),
      notifyDuePremieres({ db: second.db, now: () => NOW }),
    ]);
    expect(a.claimed + b.claimed).toBe(1);
    expect(second.created).toHaveLength(2);
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
    const { db, created } = makeDb(videos);
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result).toEqual({ candidates: 0, claimed: 0, notifications: 0, failed: 0 });
    expect(created).toHaveLength(0);
  });

  it("respects the newVideoInApp preference and excludes the channel owner in the audience query", async () => {
    const { db, raw } = makeDb([video()], ["u1"]);
    await notifyDuePremieres({ db, now: () => NOW });
    const where = raw.subscription.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ creatorId: "c1", notify: true, userId: { not: "owner" } });
    expect(JSON.stringify(where.user)).toContain("newVideoInApp");
  });

  it("takes the advisory lock and writes in chunks of 1000", async () => {
    const subs = Array.from({ length: 2500 }, (_, i) => `u${i}`);
    const { db, tx } = makeDb([video()], subs);
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result.notifications).toBe(2500);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany).toHaveBeenCalledTimes(3);
  });

  it("is bounded by the batch size", async () => {
    const videos = [video({ id: "a" }), video({ id: "b" }), video({ id: "c" })];
    const { db, raw } = makeDb(videos);
    const result = await notifyDuePremieres({ db, now: () => NOW, batchSize: 2 });
    expect(raw.video.findMany.mock.calls[0][0].take).toBe(2);
    expect(result.candidates).toBe(2);
  });

  it("releases the claim when the delivery fails so the next run retries", async () => {
    const v = video();
    const { db, raw } = makeDb([v]);
    raw.$transaction.mockRejectedValueOnce(new Error("db down"));
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result).toMatchObject({ claimed: 1, failed: 1, notifications: 0 });
    expect(v.premiereNotifiedAt).toBeNull();
    const retry = await notifyDuePremieres({ db, now: () => NOW });
    expect(retry).toMatchObject({ claimed: 1, notifications: 2, failed: 0 });
  });
});

describe("premiere cron and publish path never double-send", () => {
  it("a video announced at publish time is not announced again by the cron", async () => {
    const v = video({ premiereAt: null });
    const { db, created } = makeDb([v]);
    await fanOutNewVideo("v1", { db, now: () => NOW });
    expect(v.premiereNotifiedAt).toEqual(NOW);
    const result = await notifyDuePremieres({ db, now: () => NOW });
    expect(result.candidates).toBe(0);
    expect(created).toHaveLength(2);
  });

  it("an upcoming premiere is skipped at publish time and sent once by the cron when it starts", async () => {
    const v = video({ premiereAt: new Date("2026-10-19T13:00:00Z") });
    const { db, created } = makeDb([v]);
    expect(await fanOutNewVideo("v1", { db, now: () => NOW })).toEqual({ status: "skipped", reason: "UPCOMING_PREMIERE" });
    expect((await notifyDuePremieres({ db, now: () => NOW })).candidates).toBe(0);
    const later = () => new Date("2026-10-19T13:00:30Z");
    expect(await notifyDuePremieres({ db, now: later })).toMatchObject({ claimed: 1, notifications: 2 });
    await notifyDuePremieres({ db, now: later });
    expect(created).toHaveLength(2);
  });

  it("a premiere rescheduled later before it fired stays armed; after it fired it is not re-sent", async () => {
    const v = video({ premiereAt: new Date("2026-10-19T13:00:00Z") });
    const { db, created } = makeDb([v]);
    v.premiereAt = new Date("2026-10-19T14:00:00Z");
    expect((await notifyDuePremieres({ db, now: () => new Date("2026-10-19T13:30:00Z") })).candidates).toBe(0);
    expect(await notifyDuePremieres({ db, now: () => new Date("2026-10-19T14:00:01Z") })).toMatchObject({ claimed: 1 });
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
