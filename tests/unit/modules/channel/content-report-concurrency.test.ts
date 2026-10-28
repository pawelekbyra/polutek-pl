import { describe, expect, it } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createContentReport } from "@/lib/modules/channel";

/**
 * Audit W19: the duplicate check, the daily cap and the insert used to be separate reads and a write, so parallel
 * requests of one account all saw "no duplicate, cap not reached". The use case now takes an advisory lock per
 * reporter inside a transaction. The fake database below really serialises transactions that take the same lock key
 * and yields inside every query, so an unserialised implementation would interleave and fail these tests.
 */
const visibleVideo = { id: "v1", creatorId: "c1", status: "PUBLISHED", moderationStatus: "VISIBLE", creator: { status: "ACTIVE", deletedAt: null } };
const user = { type: "user", userId: "u1" };
const tick = () => new Promise((r) => setTimeout(r, 1));

function lockingDb() {
  const rows: { reporterId: string; targetType: string; targetId: string; status: string; createdAt: Date }[] = [];
  const queues = new Map<string, Promise<void>>();
  const makeTx = (release: Array<() => void>) => ({
    $executeRaw: async (_s: TemplateStringsArray, key: string) => {
      const prev = queues.get(key) ?? Promise.resolve();
      let done!: () => void;
      queues.set(key, new Promise<void>((r) => (done = r)));
      release.push(done);
      await prev;
    },
    contentReport: {
      findFirst: async ({ where }: { where: { reporterId: string; targetId: string } }) => {
        await tick();
        return rows.find((x) => x.reporterId === where.reporterId && x.targetId === where.targetId && x.status === "PENDING") ?? null;
      },
      count: async ({ where }: { where: { reporterId: string } }) => {
        await tick();
        return rows.filter((x) => x.reporterId === where.reporterId).length;
      },
      create: async ({ data }: { data: { reporterId: string; targetType: string; targetId: string } }) => {
        await tick();
        rows.push({ ...data, status: "PENDING", createdAt: new Date() });
        return { id: `r${rows.length}` };
      },
    },
  });
  const prisma = {
    video: { findUnique: async () => visibleVideo },
    creator: { findUnique: async () => ({ id: "c1", status: "ACTIVE", deletedAt: null }) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const release: Array<() => void> = [];
      try {
        return await fn(makeTx(release));
      } finally {
        release.forEach((r) => r());
      }
    },
  };
  return { prisma, rows };
}

const codeOf = (r: { ok: boolean; error?: unknown }) => (r.ok ? 0 : (r.error as { statusCode: number }).statusCode);

describe("createContentReport under concurrency", () => {
  it("lets only one of many parallel identical reports through", async () => {
    const { prisma, rows } = lockingDb();
    const ctx = createAppContext({ actor: user as never, prisma: prisma as never });
    const results = await Promise.all(Array.from({ length: 8 }, () => createContentReport(ctx, { targetType: "VIDEO", targetId: "v1", reason: "SPAM" })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => codeOf(r) === 409)).toBe(true);
  });

  it("holds the daily cap exactly under parallel reports of different targets", async () => {
    const { prisma, rows } = lockingDb();
    const ctx = createAppContext({ actor: user as never, prisma: prisma as never });
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => createContentReport(ctx, { targetType: "VIDEO", targetId: `v${i}`, reason: "SPAM" })));
    expect(results.filter((r) => r.ok)).toHaveLength(20);
    expect(rows).toHaveLength(20);
    expect(results.filter((r) => codeOf(r) === 429)).toHaveLength(10);
  });

  it("does not serialise different reporters against each other", async () => {
    const { prisma, rows } = lockingDb();
    const results = await Promise.all(
      ["a", "b", "c"].map((id) =>
        createContentReport(createAppContext({ actor: { type: "user", userId: id } as never, prisma: prisma as never }), { targetType: "VIDEO", targetId: "v1", reason: "SPAM" }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(rows).toHaveLength(3);
  });
});
