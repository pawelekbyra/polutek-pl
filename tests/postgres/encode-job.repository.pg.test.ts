/**
 * The encode queue's raw SQL on a real Postgres (CI job "integration-postgres", after
 * `prisma migrate deploy`): claimNext (FOR UPDATE SKIP LOCKED + advisory lock + "one RUNNING"),
 * requeueStale, markSucceeded, markFailedOrRetry, release, enqueue. Unit tests only see fakes;
 * this is where time arithmetic, enum casts and locking actually run.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EncodeJobRepository } from '@/lib/modules/video-pipeline/infrastructure/encode-job.repository';
import { STALE_HEARTBEAT_MS } from '@/lib/modules/video-pipeline/domain/encode-job.state';

const prisma = new PrismaClient();
const repo = new EncodeJobRepository(prisma);
const RUN = `pg-${Date.now().toString(36)}`;

let videoId = '';
let originalId = '';
let jobSeq = 0;

async function job(over: Record<string, unknown> = {}) {
  jobSeq += 1;
  return prisma.videoEncodeJob.create({
    data: {
      videoId,
      originalId,
      versionNumber: jobSeq,
      idempotencyKey: `${RUN}:${jobSeq}`,
      createdAt: new Date(Date.now() - 60_000 + jobSeq),
      ...over,
    },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { id: `${RUN}-user`, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: 'PG test' } });
  const video = await prisma.video.create({ data: { creatorId: creator.id, title: 'PG test', slug: `${RUN}-video`, thumbnailUrl: '/logo.png' } });
  const original = await prisma.videoOriginal.create({ data: { videoId: video.id, bucket: 'polutek', objectKey: `originals/${video.id}/x.mp4`, status: 'READY' } });
  videoId = video.id;
  originalId = original.id;
});

beforeEach(async () => {
  await prisma.videoEncodeJob.deleteMany({ where: { videoId } });
});

afterAll(async () => {
  await prisma.videoEncodeJob.deleteMany({ where: { videoId } });
  await prisma.video.deleteMany({ where: { slug: `${RUN}-video` } });
  await prisma.creator.deleteMany({ where: { slug: `${RUN}-creator` } });
  await prisma.user.deleteMany({ where: { email: `${RUN}@example.test` } });
  await prisma.$disconnect();
});

describe('EncodeJobRepository on Postgres', () => {
  it('claims the oldest due QUEUED job and marks it RUNNING for this worker', async () => {
    const older = await job();
    await job();
    const claimed = await repo.claimNext('w1', new Date());
    expect(claimed?.id).toBe(older.id);
    expect(claimed).toMatchObject({ status: 'RUNNING', stage: 'DOWNLOADING', attemptCount: 1, workerId: 'w1', progressPercent: 0 });
    expect(claimed?.heartbeatAt).toBeInstanceOf(Date);
    expect(Math.abs(claimed!.heartbeatAt!.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('runs one encode at a time: nothing is claimed while a job has a fresh heartbeat', async () => {
    await job();
    await job();
    expect(await repo.claimNext('w1', new Date())).not.toBeNull();
    expect(await repo.claimNext('w2', new Date())).toBeNull();
  });

  it('gives exactly one of two concurrent claimers the job', async () => {
    await job();
    await job();
    const results = await Promise.all([repo.claimNext('a', new Date()), repo.claimNext('b', new Date())]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prisma.videoEncodeJob.count({ where: { videoId, status: 'RUNNING' } })).toBe(1);
  });

  it('skips jobs waiting for a retry and jobs with a pending cancel', async () => {
    await job({ nextAttemptAt: new Date(Date.now() + 10 * 60_000) });
    await job({ cancelRequested: true });
    expect(await repo.claimNext('w1', new Date())).toBeNull();
    const due = await job({ nextAttemptAt: new Date(Date.now() - 1000) });
    expect((await repo.claimNext('w1', new Date()))?.id).toBe(due.id);
  });

  it('does not let a RUNNING job with a stale heartbeat block the queue, and requeues it', async () => {
    const stale = await job({ status: 'RUNNING', workerId: 'dead', attemptCount: 1, heartbeatAt: new Date(Date.now() - STALE_HEARTBEAT_MS - 60_000) });
    const next = await job();
    expect((await repo.claimNext('w1', new Date()))?.id).toBe(next.id);

    const swept = await repo.requeueStale(new Date());
    expect(swept).toEqual({ requeued: 1, failed: 0, cancelled: 0 });
    const row = await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: stale.id } });
    expect(row).toMatchObject({ status: 'QUEUED', workerId: null, failureCode: 'WORKER_LOST' });
    expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('fails a stale job that used its last attempt, and cancels one with a pending cancel', async () => {
    const old = new Date(Date.now() - STALE_HEARTBEAT_MS - 60_000);
    const spent = await job({ status: 'RUNNING', workerId: 'dead', attemptCount: 3, maxAttempts: 3, heartbeatAt: old });
    const cancelled = await job({ status: 'RUNNING', workerId: 'dead', attemptCount: 1, heartbeatAt: old, cancelRequested: true });
    expect(await repo.requeueStale(new Date())).toEqual({ requeued: 0, failed: 1, cancelled: 1 });
    expect((await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: spent.id } })).status).toBe('FAILED');
    expect((await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: cancelled.id } })).status).toBe('CANCELLED');
  });

  it('only lets the owning worker finish a job', async () => {
    await job();
    const claimed = (await repo.claimNext('w1', new Date()))!;
    expect(await repo.markSucceeded(claimed.id, 'intruder', { assetId: 'x', result: {} })).toBe(false);
    expect(await repo.markSucceeded(claimed.id, 'w1', { assetId: 'asset-1', result: { ok: true } })).toBe(true);
    expect(await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: claimed.id } })).toMatchObject({ status: 'SUCCEEDED', stage: 'DONE', progressPercent: 100, assetId: 'asset-1' });
  });

  it('retries with a delay or fails for good', async () => {
    await job();
    const claimed = (await repo.claimNext('w1', new Date()))!;
    const now = new Date();
    expect(await repo.markFailedOrRetry(claimed.id, 'w1', { next: 'QUEUED', code: 'TRANSIENT_ERROR', message: 'x', delayMs: 60_000 }, now)).toBe(true);
    const retry = await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(retry).toMatchObject({ status: 'QUEUED', workerId: null, failureCode: 'TRANSIENT_ERROR' });
    expect(retry.nextAttemptAt!.getTime()).toBe(now.getTime() + 60_000);
    // not due yet
    expect(await repo.claimNext('w1', new Date())).toBeNull();

    await prisma.videoEncodeJob.update({ where: { id: claimed.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    const again = (await repo.claimNext('w1', new Date()))!;
    expect(again.attemptCount).toBe(2);
    expect(await repo.markFailedOrRetry(again.id, 'w1', { next: 'FAILED', code: 'INVALID_MEDIA', message: 'bad' }, new Date())).toBe(true);
    expect(await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: again.id } })).toMatchObject({ status: 'FAILED', failureCode: 'INVALID_MEDIA' });
  });

  it('release puts the job back without using up the attempt', async () => {
    await job();
    const claimed = (await repo.claimNext('w1', new Date()))!;
    expect(claimed.attemptCount).toBe(1);
    expect(await repo.release(claimed.id, 'other')).toBe(false);
    expect(await repo.release(claimed.id, 'w1')).toBe(true);
    expect(await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: claimed.id } })).toMatchObject({ status: 'QUEUED', attemptCount: 0, workerId: null, nextAttemptAt: null });
    expect((await repo.claimNext('w2', new Date()))?.id).toBe(claimed.id);
  });

  it('reports progress only while owning the job, and passes the cancel flag back', async () => {
    await job();
    const claimed = (await repo.claimNext('w1', new Date()))!;
    expect(await repo.reportProgress(claimed.id, 'w1', { stage: 'ENCODING', progressPercent: 40 })).toEqual({ owned: true, cancelRequested: false });
    await repo.requestCancel(claimed.id, videoId);
    expect(await repo.reportProgress(claimed.id, 'w1', { progressPercent: 41 })).toEqual({ owned: true, cancelRequested: true });
    expect(await repo.reportProgress(claimed.id, 'w2', { progressPercent: 42 })).toEqual({ owned: false, cancelRequested: false });
  });

  it('enqueue is idempotent per original and numbers versions after existing ones', async () => {
    const first = await repo.enqueue({ videoId, originalId, requestedById: null });
    const again = await repo.enqueue({ videoId, originalId, requestedById: null });
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, job: { id: first.job.id } });
    await prisma.videoEncodeJob.update({ where: { id: first.job.id }, data: { status: 'SUCCEEDED' } });
    const second = await repo.enqueue({ videoId, originalId, requestedById: null });
    expect(second.job.versionNumber).toBe(first.job.versionNumber + 1);
  });
});
