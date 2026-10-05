/**
 * Migration 20261005210000_cleanup_dead_schema on a real Postgres, WITH DATA. The test builds its own scratch database
 * (CREATE DATABASE; skipped with a message when the role may not create databases), applies every migration except
 * the cleanup one, seeds rows into every table/column the cleanup drops plus live rows around them
 * (fixtures/pre-cleanup-seed.sql), applies the migration and checks: it is atomic (a failing script changes nothing),
 * it succeeds, live data is intact, dropped objects are gone, values were folded/mapped as documented, the Prisma
 * client works on the result, the file is idempotent and `prisma migrate deploy` has nothing left to do.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts tests/postgres/db-cleanup-migration.pg.test.ts
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATION = '20261005210000_cleanup_dead_schema';
const root = path.resolve(__dirname, '../..');
const migrationSql = readFileSync(path.join(root, 'prisma/migrations', MIGRATION, 'migration.sql'), 'utf8');
const seedSql = readFileSync(path.join(__dirname, 'fixtures/pre-cleanup-seed.sql'), 'utf8');

const adminUrl = new URL(process.env.DATABASE_URL!);
const scratchName = `dbclean_test_${Date.now().toString(36)}`;
const scratchUrl = new URL(adminUrl.toString());
scratchUrl.pathname = `/${scratchName}`;
scratchUrl.search = '';

const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
let sql: postgres.Sql;
let prisma: PrismaClient;
let ready = false;
let tmpDir = '';

const prismaEnv = { ...process.env, DATABASE_URL: scratchUrl.toString(), DATABASE_URL_UNPOOLED: scratchUrl.toString() };
const cli = (...args: string[]) => execFileSync('npx', ['prisma', ...args], { cwd: root, env: prismaEnv, stdio: 'pipe' }).toString();

const rel = async (name: string) => (await sql`select to_regclass(${`public."${name}"`}) as r`)[0].r;
const hasColumn = async (table: string, column: string) =>
  (await sql`select 1 from information_schema.columns where table_schema = 'public' and table_name = ${table} and column_name = ${column}`).length > 0;
const count = async (table: string) => Number((await sql.unsafe(`select count(*)::int as n from "${table}"`))[0].n);

const DROPPED_TABLES = ['ClerkEvent', 'CommentLike', 'CommentDislike', 'VideoDistributionPlan', 'VideoDistributionTarget', 'VideoProviderJob', 'VideoProviderWebhookEvent'];
const DROPPED_TYPES = ['VideoDistributionMode', 'VideoPlaybackSelectionPolicy', 'VideoAutopublishPolicy', 'VideoDistributionTargetStatus', 'VideoDistributionTargetRole', 'VideoProviderJobType', 'VideoProviderJobStatus', 'VideoProviderWebhookStatus'];
const DROPPED_COLUMNS: Record<string, string[]> = {
  User: ['totalPaidMinor', 'canCreateChannel'],
  Creator: ['bannerUrl', 'stripeConnectId'],
  Comment: ['score', 'pinnedById'],
  Video: ['videoUrl', 'publishAfterAssetReadyProvider'],
  VideoOriginal: ['storageProvider', 'checksumSha256'],
  VideoAsset: ['distributionTargetId', 'providerAssetId', 'providerPlaybackId', 'externalVideoId', 'externalUrl', 'muxUploadId', 'pendingPrimaryIntent', 'providerSyncedAt', 'processingStartedAt', 'fallbackPriority', 'mirrorSourceOriginalId', 'mirrorRequestedAt', 'mirrorCompletedAt', 'mirrorFailureReason'],
  VideoPlaybackRoute: ['planId'],
  VideoPlaybackSession: ['endedAt'],
  EmailPreference: ['resendContactId'],
  BroadcastEmail: ['templateId'],
  PaymentCurrencySetting: ['patronThresholdMinor', 'patronBoxMinMinor'],
};

beforeAll(async () => {
  try {
    await admin.unsafe(`create database "${scratchName}"`);
  } catch (error) {
    console.warn(`[db-cleanup-migration] cannot create a scratch database (${String(error)}): test skipped`);
    return;
  }
  // The migrations folder without the cleanup migration = the production state before this change.
  tmpDir = mkdtempSync(path.join(tmpdir(), 'dbclean-'));
  cpSync(path.join(root, 'prisma'), path.join(tmpDir, 'prisma'), { recursive: true });
  rmSync(path.join(tmpDir, 'prisma/migrations', MIGRATION), { recursive: true, force: true });
  cli('migrate', 'deploy', '--schema', path.join(tmpDir, 'prisma/schema.prisma'));
  sql = postgres(scratchUrl.toString(), { max: 1, onnotice: () => {} });
  await sql.unsafe(seedSql);
  prisma = new PrismaClient({ datasources: { db: { url: scratchUrl.toString() } } });
  ready = true;
}, 240_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await sql?.end();
  await admin.unsafe(`drop database if exists "${scratchName}" with (force)`).catch(() => undefined);
  await admin.end();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe('cleanup migration with data', () => {
  it('starts from the seeded pre-cleanup state', async ({ skip }) => {
    if (!ready) skip();
    for (const t of DROPPED_TABLES) expect(await rel(t), t).not.toBeNull();
    expect(await count('ClerkEvent')).toBe(1);
    expect(await count('VideoProviderJob')).toBe(1);
    expect(await count('CommentLike')).toBe(1);
    expect(await hasColumn('User', 'totalPaidMinor')).toBe(true);
  });

  it('is atomic: a script that fails at the end changes nothing', async ({ skip }) => {
    if (!ready) skip();
    await expect(sql.unsafe(`${migrationSql}\nselect 1/0;`)).rejects.toThrow(/division by zero/);
    expect(await rel('ClerkEvent')).not.toBeNull();
    expect(await hasColumn('User', 'totalPaidMinor')).toBe(true);
    const [{ labels }] = await sql`select array_agg(enumlabel order by enumsortorder) as labels from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'AccessTier'`;
    expect(labels).toEqual(['PUBLIC', 'LOGGED_IN', 'PATRON']);
  });

  it('applies through `prisma migrate deploy`', async ({ skip }) => {
    if (!ready) skip();
    const out = cli('migrate', 'deploy');
    expect(out).toContain(MIGRATION);
    expect(out).toContain('successfully applied');
  });

  it('removes every dropped table, type and column', async ({ skip }) => {
    if (!ready) skip();
    for (const t of DROPPED_TABLES) expect(await rel(t), t).toBeNull();
    const types = await sql`select typname from pg_type where typname in ${sql(DROPPED_TYPES)} or typname = 'AccessTier_new'`;
    expect(types).toHaveLength(0);
    for (const [table, columns] of Object.entries(DROPPED_COLUMNS)) {
      for (const c of columns) expect(await hasColumn(table, c), `${table}.${c}`).toBe(false);
    }
  });

  it('keeps all live data', async ({ skip }) => {
    if (!ready) skip();
    expect(await count('User')).toBe(2);
    expect(await count('Creator')).toBe(1);
    expect(await count('Video')).toBe(3);
    expect(await count('VideoAsset')).toBe(2);
    expect(await count('VideoPlaybackRoute')).toBe(2);
    expect(await count('Comment')).toBe(2);
    expect(await count('CommentReaction')).toBe(1);
    expect(await count('VideoPlaybackSession')).toBe(3);
    expect(await count('VideoPlaybackEvent')).toBe(1);
    expect(await count('Payment')).toBe(1);
    expect(await count('PatronGrant')).toBe(1);
    expect(await count('UserPaymentTotal')).toBe(1);
    expect(await count('Notification')).toBe(1);
    expect(await count('Subscription')).toBe(1);
    expect(await count('StripeEvent')).toBe(1);
    expect(await count('EmailPreference')).toBe(1);
    const [bc] = await sql`select id, "scheduledAt" is not null as scheduled from "BroadcastEmail"`;
    expect(bc).toMatchObject({ id: 'b1', scheduled: true });
    const [comment] = await sql`select "likesCount", "pinnedAt" is not null as pinned from "Comment" where id = 'm1'`;
    expect(comment).toMatchObject({ likesCount: 2, pinned: true });
    const [user] = await sql`select email, name from "User" where id = 'u1'`;
    expect(user).toMatchObject({ email: 'u1@example.test', name: 'alice' });
  });

  it('maps AccessTier PATRON to LOGGED_IN and keeps the default', async ({ skip }) => {
    if (!ready) skip();
    const [{ labels }] = await sql`select array_agg(enumlabel order by enumsortorder) as labels from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'AccessTier'`;
    expect(labels).toEqual(['PUBLIC', 'LOGGED_IN']);
    const videos = await sql`select id, tier::text from "Video" order by id`;
    expect(videos.map((v) => [v.id, v.tier])).toEqual([['v1', 'PUBLIC'], ['v2', 'LOGGED_IN'], ['v3', 'LOGGED_IN']]);
    const sessions = await sql`select id, "accessTier"::text as t from "VideoPlaybackSession" order by id`;
    expect(sessions.map((s) => [s.id, s.t])).toEqual([['s1', 'PUBLIC'], ['s2', 'LOGGED_IN'], ['s3', 'LOGGED_IN']]);
    const [{ d }] = await sql`select column_default as d from information_schema.columns where table_name = 'Video' and column_name = 'tier'`;
    expect(d).toContain("'PUBLIC'");
  });

  it('folds the legacy tip-box minimum into minAmountMinor (effective minimum unchanged)', async ({ skip }) => {
    if (!ready) skip();
    const rows = await sql`select currency, "minAmountMinor" from "PaymentCurrencySetting" where currency in ('PLN', 'EUR', 'USD') order by currency`;
    expect(rows.map((r) => [r.currency, r.minAmountMinor])).toEqual([['EUR', 400], ['PLN', 700], ['USD', 500]]);
  });

  it('stores sizes above 2 GiB (VideoAsset.sizeBytes is BIGINT)', async ({ skip }) => {
    if (!ready) skip();
    const [{ t }] = await sql`select data_type as t from information_schema.columns where table_name = 'VideoAsset' and column_name = 'sizeBytes'`;
    expect(t).toBe('bigint');
    const big = 5n * 1024n ** 3n;
    await prisma.videoAsset.update({ where: { id: 'a1' }, data: { sizeBytes: big } });
    expect((await prisma.videoAsset.findUniqueOrThrow({ where: { id: 'a1' } })).sizeBytes).toBe(big);
    await prisma.videoAsset.update({ where: { id: 'a1' }, data: { sizeBytes: 123456n } });
  });

  it('the Prisma client reads and writes the migrated tables', async ({ skip }) => {
    if (!ready) skip();
    const video = await prisma.video.findUniqueOrThrow({ where: { slug: 'old-patron' }, include: { assets: true, playbackRoutes: true } });
    expect(video.tier).toBe('LOGGED_IN');
    expect(await prisma.comment.findMany({ where: { authorId: 'u2' } })).toHaveLength(1);
    expect(await prisma.videoPlaybackSession.count({ where: { countedAsView: false } })).toBe(3);
    expect(await prisma.payment.count({ where: { status: 'PENDING' } })).toBe(1);
    const created = await prisma.videoPlaybackSession.create({ data: { videoId: 'v1', accessTier: 'LOGGED_IN' } });
    await prisma.videoPlaybackSession.delete({ where: { id: created.id } });
  });

  it('creates the new indexes', async ({ skip }) => {
    if (!ready) skip();
    const idx = await sql`select indexname from pg_indexes where schemaname = 'public' and indexname in ('Comment_authorId_idx', 'VideoPlaybackSession_countedAsView_startedAt_idx', 'Payment_status_createdAt_idx')`;
    expect(idx).toHaveLength(3);
  });

  it('is idempotent: running the file again succeeds and changes nothing', async ({ skip }) => {
    if (!ready) skip();
    await sql.unsafe(migrationSql);
    expect(await count('Comment')).toBe(2);
    expect(await rel('ClerkEvent')).toBeNull();
    const [{ labels }] = await sql`select array_agg(enumlabel order by enumsortorder) as labels from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'AccessTier'`;
    expect(labels).toEqual(['PUBLIC', 'LOGGED_IN']);
  });

  it('leaves nothing for `prisma migrate deploy` and no drift against schema.prisma', async ({ skip }) => {
    if (!ready) skip();
    expect(cli('migrate', 'deploy')).toContain('No pending migrations');
    const diff = cli('migrate', 'diff', '--from-url', scratchUrl.toString(), '--to-schema-datamodel', path.join(root, 'prisma/schema.prisma'), '--script');
    expect(diff).toContain('-- This is an empty migration.');
  });
});
