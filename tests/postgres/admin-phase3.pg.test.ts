/**
 * Admin panel phase 3 on a real Postgres (CI job "integration-postgres", after `prisma migrate deploy`):
 * the tamper-resistant AuditLog (migration 20261005200000) and the translator role tables.
 * NOT run in the authoring environment (no local Postgres); written to the pattern of admin-panel-auth.pg.test.ts.
 *
 *   DATABASE_URL=postgresql://... npx vitest run --config vitest.postgres.config.ts tests/postgres/admin-phase3.pg.test.ts
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient();
const RUN = `pg-p3-${Date.now().toString(36)}`;

afterAll(async () => {
  await prisma.adminUser.deleteMany({ where: { email: `${RUN}@example.test` } });
  await prisma.$disconnect();
});

describe('AuditLog is tamper-resistant', () => {
  it('refuses UPDATE of anything but blanking ip/userAgent', async () => {
    const row = await prisma.auditLog.create({ data: { action: `${RUN}-a`, ip: '203.0.113.9', userAgent: 'UA', metadata: { before: 1 } } });
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: `${RUN}-b` } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { metadata: { before: 2 } } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { ip: '198.51.100.1' } })).rejects.toThrow(/append-only/);
    // The retention job's anonymization still works.
    await prisma.auditLog.update({ where: { id: row.id }, data: { ip: null, userAgent: null } });
    expect(await prisma.auditLog.findUnique({ where: { id: row.id } })).toMatchObject({ ip: null, userAgent: null, action: `${RUN}-a` });
  });

  it('refuses early DELETE and TRUNCATE, but allows deleting a row older than 400 days', async () => {
    const young = await prisma.auditLog.create({ data: { action: `${RUN}-young` } });
    await expect(prisma.auditLog.delete({ where: { id: young.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE "AuditLog"')).rejects.toThrow(/cannot be truncated/);
    const old = await prisma.auditLog.create({ data: { action: `${RUN}-old`, createdAt: new Date(Date.now() - 401 * 86_400_000) } });
    await prisma.auditLog.delete({ where: { id: old.id } });
    expect(await prisma.auditLog.findUnique({ where: { id: old.id } })).toBeNull();
  });
});

describe('translator role tables', () => {
  it('defaults an account to OWNER and keeps one grant per language, removed with the account', async () => {
    const user = await prisma.adminUser.create({ data: { id: `${RUN}-u`, email: `${RUN}@example.test`, name: 'T' } });
    expect(user.role).toBe('OWNER');
    await prisma.adminUser.update({ where: { id: user.id }, data: { role: 'TRANSLATOR' } });
    await prisma.adminLanguageGrant.create({ data: { adminUserId: user.id, language: 'de' } });
    await expect(prisma.adminLanguageGrant.create({ data: { adminUserId: user.id, language: 'de' } })).rejects.toThrow();
    await prisma.adminUser.delete({ where: { id: user.id } });
    expect(await prisma.adminLanguageGrant.count({ where: { adminUserId: user.id } })).toBe(0);
  });
});
