/**
 * The durable job queue's and the broadcast lease's raw SQL on a real Postgres (CI job
 * "integration-postgres", after `prisma migrate deploy`): FOR UPDATE SKIP LOCKED claim, lease expiry,
 * token-conditional writes, checkpoint inside a transaction, database-clock arithmetic.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DurableJobRepository } from '@/lib/modules/shared/durable-job.repository';
import { BroadcastQueueRepository } from '@/lib/modules/email/infrastructure/broadcast-queue.repository';

const prisma = new PrismaClient();
const repo = new DurableJobRepository(prisma);
const broadcasts = new BroadcastQueueRepository(prisma);
const RUN = `pg-${Date.now().toString(36)}`;
const KIND = 'NEW_VIDEO_FANOUT' as const;
const LEASE_MS = 60_000;

beforeEach(async () => {
  await prisma.durableJob.deleteMany({ where: { dedupeKey: { startsWith: RUN } } });
  await prisma.broadcastEmail.deleteMany({ where: { requestKey: { startsWith: RUN } } });
});

afterAll(async () => {
  await prisma.durableJob.deleteMany({ where: { dedupeKey: { startsWith: RUN } } });
  await prisma.broadcastEmail.deleteMany({ where: { requestKey: { startsWith: RUN } } });
  await prisma.$disconnect();
});

describe('DurableJobRepository on Postgres', () => {
  it('enqueues once per (kind, dedupeKey) and reopens a finished job only when asked', async () => {
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-a`, payload: { variant: 'publish' } });
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-a`, payload: { variant: 'premiere' } });
    expect(await prisma.durableJob.count({ where: { dedupeKey: `${RUN}-a` } })).toBe(1);

    await prisma.durableJob.updateMany({ where: { dedupeKey: `${RUN}-a` }, data: { status: 'DONE', cursor: 'u9' } });
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-a`, payload: { variant: 'publish' } });
    expect((await prisma.durableJob.findFirstOrThrow({ where: { dedupeKey: `${RUN}-a` } })).status).toBe('DONE');
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-a`, payload: { variant: 'publish' }, reopen: ['DONE'] });
    expect(await prisma.durableJob.findFirstOrThrow({ where: { dedupeKey: `${RUN}-a` } })).toMatchObject({ status: 'PENDING', cursor: null });
  });

  it('gives exactly one of two concurrent claimers the job, with a lease owned by its token', async () => {
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-b`, payload: {} });
    const results = await Promise.all([repo.claimNext([KIND], LEASE_MS, 'tok-1'), repo.claimNext([KIND], LEASE_MS, 'tok-2')]);
    const claimed = results.filter((r) => r && r.dedupeKey === `${RUN}-b`);
    expect(claimed).toHaveLength(1);
    const row = await prisma.durableJob.findFirstOrThrow({ where: { dedupeKey: `${RUN}-b` } });
    expect(row.lockedBy).toBe(claimed[0]!.token);
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now() - 5_000);
  });

  it('takes over a job whose lease ran out; the old owner can no longer write', async () => {
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-c`, payload: {} });
    const a = (await repo.claimNext([KIND], LEASE_MS, 'tok-A'))!;
    expect(await repo.checkpoint(a, 'page-1', LEASE_MS)).toBe(true);
    await prisma.durableJob.update({ where: { id: a.id }, data: { lockedUntil: new Date(Date.now() - 1_000) } }); // the lease runs out
    const b = (await repo.claimNext([KIND], LEASE_MS, 'tok-B'))!;
    expect(b.id).toBe(a.id);
    expect(b.cursor).toBe('page-1');
    expect(await repo.checkpoint(a, 'page-9', LEASE_MS)).toBe(false);
    expect(await repo.complete(a)).toBe(false);
    expect(await repo.release(a, { runAfter: new Date() })).toBe(false);
    expect(await repo.complete(b)).toBe(true);
    expect(await prisma.durableJob.findFirstOrThrow({ where: { dedupeKey: `${RUN}-c` } })).toMatchObject({ status: 'DONE', cursor: 'page-1', lockedBy: null });
  });

  it('a checkpoint inside a transaction rolls back with it', async () => {
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-d`, payload: {} });
    const job = (await repo.claimNext([KIND], LEASE_MS, 'tok-D'))!;
    await expect(
      prisma.$transaction(async (tx) => {
        expect(await repo.checkpoint(job, 'page-1', LEASE_MS, tx)).toBe(true);
        throw new Error('page failed');
      }),
    ).rejects.toThrow('page failed');
    expect((await prisma.durableJob.findFirstOrThrow({ where: { dedupeKey: `${RUN}-d` } })).cursor).toBeNull();
  });

  it('a released job waits for its backoff time and counts the attempt; DEAD is never claimed', async () => {
    await repo.enqueue({ kind: KIND, dedupeKey: `${RUN}-e`, payload: {} });
    const job = (await repo.claimNext([KIND], LEASE_MS, 'tok-E'))!;
    expect(await repo.release(job, { runAfter: new Date(Date.now() + 3_600_000), error: 'boom', countAttempt: true })).toBe(true);
    expect(await repo.claimNext([KIND], LEASE_MS, 'tok-E2')).toBeNull();
    expect(await prisma.durableJob.findFirstOrThrow({ where: { dedupeKey: `${RUN}-e` } })).toMatchObject({ attempts: 1, lastError: 'boom', lockedBy: null });
    await prisma.durableJob.updateMany({ where: { dedupeKey: `${RUN}-e` }, data: { runAfter: new Date(Date.now() - 1_000), status: 'DEAD' } });
    expect(await repo.claimNext([KIND], LEASE_MS, 'tok-E3')).toBeNull();
  });
});

describe('BroadcastQueueRepository lease owner on Postgres', () => {
  async function ready() {
    return prisma.broadcastEmail.create({
      data: { subjectPl: 's', htmlPl: '<p>h</p>', subjectEn: 's', htmlEn: '<p>h</p>', status: 'READY', requestKey: `${RUN}-${Math.random()}`, createdAt: new Date(Date.now() - 86_400_000 * 365) },
    });
  }

  it('claim stores an owner token; only the owner can renew, release or finalize', async () => {
    const b = await ready();
    const claimed = await broadcasts.claimNext(LEASE_MS);
    expect(claimed?.id).toBe(b.id);
    expect((await prisma.broadcastEmail.findUniqueOrThrow({ where: { id: b.id } })).lockedBy).toBe(claimed!.leaseToken);

    expect(await broadcasts.renewLease(b.id, claimed!.leaseToken, LEASE_MS)).toBe(true);
    expect(await broadcasts.renewLease(b.id, 'someone-else', LEASE_MS)).toBe(false);

    await broadcasts.release(b.id, 'someone-else', null);
    expect((await prisma.broadcastEmail.findUniqueOrThrow({ where: { id: b.id } })).lockedUntil).not.toBeNull();
    await broadcasts.finalize(b.id, 'someone-else');
    expect((await prisma.broadcastEmail.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('SENDING');

    await broadcasts.release(b.id, claimed!.leaseToken, null);
    expect(await prisma.broadcastEmail.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ lockedUntil: null, lockedBy: null });
  });

  it('a new run can take over after the lease expired, and the old token is dead', async () => {
    const b = await ready();
    const first = (await broadcasts.claimNext(LEASE_MS))!;
    await prisma.broadcastEmail.update({ where: { id: b.id }, data: { lockedUntil: new Date(Date.now() - 1_000) } });
    const second = (await broadcasts.claimNext(LEASE_MS))!;
    expect(second.id).toBe(b.id);
    expect(second.leaseToken).not.toBe(first.leaseToken);
    expect(await broadcasts.renewLease(b.id, first.leaseToken, LEASE_MS)).toBe(false);
    await broadcasts.finalize(b.id, first.leaseToken);
    expect((await prisma.broadcastEmail.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('SENDING');
  });
});
