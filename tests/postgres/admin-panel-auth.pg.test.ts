/**
 * Admin panel identity on a real Postgres (CI job "integration-postgres", after `prisma migrate deploy`):
 * the append-only AdminAuthEvent trigger, the one-time enrollment from the CLI and the overview read model.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts tests/postgres/admin-panel-auth.pg.test.ts
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import * as cli from '../../apps/admin/scripts/admin-enroll.mjs';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { createOverviewDeps, getTodayOverview, getSystemOverview } from '@/lib/modules/admin-overview';

const prisma = new PrismaClient();
const RUN = `pg-adm-${Date.now().toString(36)}`;
const email = `${RUN}@example.test`;

afterAll(async () => {
  await prisma.adminUser.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('AdminAuthEvent is append-only', () => {
  it('refuses UPDATE, early DELETE and TRUNCATE at the database level', async () => {
    const row = await prisma.adminAuthEvent.create({ data: { action: 'ADMIN_SIGN_IN', outcome: 'success', hash: `${RUN}-h` } });
    await expect(prisma.adminAuthEvent.update({ where: { id: row.id }, data: { outcome: 'failure' } })).rejects.toThrow(/append-only/);
    await expect(prisma.adminAuthEvent.delete({ where: { id: row.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE "AdminAuthEvent"')).rejects.toThrow(/cannot be truncated/);
    expect(await prisma.adminAuthEvent.findUnique({ where: { id: row.id } })).not.toBeNull();
  });
});

describe('admin-enroll against the real schema', () => {
  it('creates the account, a hashed one-time token and a chained audit row', async () => {
    const { token, userId } = await cli.issueEnrollment(prisma, { email, name: 'Test', reset: false });
    const stored = await prisma.adminEnrollment.findUnique({ where: { tokenHash: cli.hashEnrollmentToken(token) } });
    expect(stored).toMatchObject({ userId, usedAt: null });
    const event = await prisma.adminAuthEvent.findFirst({ where: { adminUserId: userId }, orderBy: { seq: 'desc' } });
    expect(event).toMatchObject({ action: 'ADMIN_ENROLL_ISSUED', outcome: 'success' });
    const recomputed = cli.chainHash(event!.prevHash, cli.canonicalEventString(event!));
    expect(recomputed).toBe(event!.hash);
  });

  it('--reset removes sessions and passkeys and voids the previous link', async () => {
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    await prisma.adminUser.update({ where: { id: user.id }, data: { enrolledAt: new Date() } });
    await prisma.adminSession.create({ data: { id: `${RUN}-s`, token: `${RUN}-t`, expiresAt: new Date(Date.now() + 3600_000), userId: user.id } });
    await prisma.adminPasskey.create({ data: { id: `${RUN}-p`, publicKey: 'k', userId: user.id, credentialID: `${RUN}-c`, counter: 0, deviceType: 'singleDevice', backedUp: false } });
    await expect(cli.issueEnrollment(prisma, { email, reset: false })).rejects.toThrow(/--reset/);
    await cli.issueEnrollment(prisma, { email, reset: true });
    expect(await prisma.adminSession.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.adminPasskey.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.adminEnrollment.count({ where: { userId: user.id, usedAt: null } })).toBe(1);
    expect((await prisma.adminUser.findUniqueOrThrow({ where: { id: user.id } })).enrolledAt).toBeNull();
  });
});

describe('overview read model on real tables', () => {
  it('runs every query of Dzisiaj and System without errors', async () => {
    const deps = createOverviewDeps(createAppContext({ actor: { type: 'system', reason: 'pg-test' }, prisma }), {});
    const today = await getTodayOverview(deps, { range: '28d', compare: 'prev' });
    expect(today.kpis).toHaveLength(6);
    expect(today.chart.labels).toHaveLength(28);
    const system = await getSystemOverview(deps);
    expect(system.database.latencyMs).not.toBeNull();
    expect(system.health.checks.find((c) => c.id === 'database')?.kind).not.toBe('crit');
  });
});
