import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ClaimedJob, DurableJobStore, EnqueueInput } from "./durable-job";

type Db = PrismaClient | Prisma.TransactionClient;

const secondsOf = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

/**
 * Prisma/Postgres implementation of the durable job store. Lease times come from the database clock
 * in UTC (like the encode queue and the e-mail broadcast queue), so a skewed app clock cannot
 * shorten or lengthen a lease. Every write after the claim is conditional on `lockedBy = token`.
 */
export class DurableJobRepository implements DurableJobStore<Prisma.TransactionClient> {
  constructor(private readonly db: PrismaClient) {}

  async enqueue(input: EnqueueInput, tx?: Prisma.TransactionClient): Promise<void> {
    const db: Db = tx ?? this.db;
    await db.durableJob.createMany({
      data: [{ id: randomUUID(), kind: input.kind, dedupeKey: input.dedupeKey, payload: input.payload as Prisma.InputJsonValue, runAfter: new Date() }],
      skipDuplicates: true,
    });
    const reopen = input.reopen ?? [];
    if (reopen.length > 0) {
      // A finished job asked for again (e.g. a video re-published): run it again from the start. Per-item
      // idempotence of the handler makes the repeat harmless; a job that is PENDING is left alone.
      await db.durableJob.updateMany({
        where: { kind: input.kind, dedupeKey: input.dedupeKey, status: { in: reopen } },
        data: { status: "PENDING", cursor: null, attempts: 0, runAfter: new Date(), completedAt: null, lockedBy: null, lockedUntil: null, lastError: null, payload: input.payload as Prisma.InputJsonValue },
      });
    }
  }

  async claimNext(kinds: string[], leaseMs: number, token: string): Promise<ClaimedJob | null> {
    const rows = await this.db.$queryRaw<Array<{ id: string; kind: string; dedupeKey: string; payload: unknown; cursor: string | null; attempts: number }>>`
      UPDATE "DurableJob" AS j
      SET "lockedBy" = ${token},
          "lockedUntil" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${secondsOf(leaseMs)}::double precision),
          "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE j."id" = (
        SELECT c."id" FROM "DurableJob" AS c
        WHERE c."status" = 'PENDING'
          AND c."kind" = ANY(${kinds}::text[])
          AND c."runAfter" <= (now() AT TIME ZONE 'UTC')
          AND (c."lockedUntil" IS NULL OR c."lockedUntil" < (now() AT TIME ZONE 'UTC'))
        ORDER BY c."runAfter" ASC, c."createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING j."id", j."kind", j."dedupeKey", j."payload", j."cursor", j."attempts"
    `;
    const row = rows[0];
    return row ? { ...row, token } : null;
  }

  async checkpoint(job: ClaimedJob, cursor: string | null, leaseMs: number, tx?: Prisma.TransactionClient): Promise<boolean> {
    const db: Db = tx ?? this.db;
    const changed = await db.$executeRaw`
      UPDATE "DurableJob"
      SET "cursor" = ${cursor},
          "lockedUntil" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${secondsOf(leaseMs)}::double precision),
          "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE "id" = ${job.id} AND "lockedBy" = ${job.token} AND "status" = 'PENDING'
    `;
    return changed === 1;
  }

  async complete(job: ClaimedJob): Promise<boolean> {
    const res = await this.db.durableJob.updateMany({
      where: { id: job.id, lockedBy: job.token, status: "PENDING" },
      data: { status: "DONE", completedAt: new Date(), lockedBy: null, lockedUntil: null, lastError: null },
    });
    return res.count === 1;
  }

  async release(job: ClaimedJob, input: { runAfter: Date; error?: string; countAttempt?: boolean; dead?: boolean }): Promise<boolean> {
    const res = await this.db.durableJob.updateMany({
      where: { id: job.id, lockedBy: job.token, status: "PENDING" },
      data: {
        lockedBy: null,
        lockedUntil: null,
        runAfter: input.runAfter,
        ...(input.error !== undefined ? { lastError: input.error } : {}),
        ...(input.countAttempt ? { attempts: { increment: 1 } } : {}),
        ...(input.dead ? { status: "DEAD" as const } : {}),
      },
    });
    return res.count === 1;
  }
}
