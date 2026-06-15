import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdminChannelSettings } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { prisma } from '@/lib/prisma';
import { MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from '@/lib/modules/channel/domain/channel.errors';
import { Prisma } from '@prisma/client';
import { classifyAdminChannelError } from '@/lib/admin-channel-error-classification';

/**
 * Admin Channel Settings - Real Postgres Integration.
 * Requires a running PostgreSQL database (CI or local).
 *
 * It performs REAL queries against the database configured in DATABASE_URL.
 */
describe('Admin Channel Settings - Real Postgres Integration', () => {
  const itWithDb = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  async function cleanup() {
    if (process.env.RUN_INTEGRATION_TESTS === 'true') {
        try {
            await prisma.creator.deleteMany({
                where: {
                    slug: { in: ['test-integration-slug', 'non-approved-slug', 'non-primary-slug', 'sub-count-slug'] }
                }
            });
            await prisma.user.deleteMany({
                where: {
                    id: { in: ['admin-test-id', 'admin-no-chan-id', 'admin-non-approved-id', 'admin-non-primary-id', 'admin-sub-count-id'] }
                }
            });
        } catch (e) {
            // Best effort cleanup
        }
    }
  }

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  itWithDb('poprawny admin dostaje dane kanału', async () => {
    const admin = await prisma.user.create({
        data: {
            id: 'admin-test-id',
            email: 'admin-test@example.com',
            role: 'ADMIN',
        }
    });

    await prisma.creator.create({
        data: {
            userId: admin.id,
            slug: 'test-integration-slug',
            name: 'Integration Test Channel',
            isApproved: true,
            isPrimary: true,
        }
    });

    const ctx = createAppContext({
        actor: { type: 'admin', userId: admin.id },
        prisma: prisma
    });

    vi.stubEnv('MAIN_CREATOR_SLUG', 'test-integration-slug');

    const result = await getAdminChannelSettings(ctx);

    expect(result).toBeDefined();
    expect(result.slug).toBe('test-integration-slug');
    expect(result.name).toBe('Integration Test Channel');

    vi.unstubAllEnvs();
  });

  itWithDb('brak kanału zwraca błąd', async () => {
    const admin = await prisma.user.create({
        data: {
            id: 'admin-no-chan-id',
            email: 'admin-no-chan@example.com',
            role: 'ADMIN',
        }
    });

    const ctx = createAppContext({
        actor: { type: 'admin', userId: admin.id },
        prisma: prisma
    });

    vi.stubEnv('MAIN_CREATOR_SLUG', 'non-existent-slug');

    await expect(getAdminChannelSettings(ctx)).rejects.toThrow(MainChannelNotFoundError);

    vi.unstubAllEnvs();
  });

  itWithDb('kanał niezatwierdzony zwraca błąd', async () => {
     const admin = await prisma.user.create({
        data: {
            id: 'admin-non-approved-id',
            email: 'admin-non-approved@example.com',
            role: 'ADMIN',
        }
    });

    await prisma.creator.create({
        data: {
            userId: admin.id,
            slug: 'non-approved-slug',
            name: 'Non Approved Channel',
            isApproved: false,
            isPrimary: true,
        }
    });

    const ctx = createAppContext({
        actor: { type: 'admin', userId: admin.id },
        prisma: prisma
    });

    vi.stubEnv('MAIN_CREATOR_SLUG', 'non-approved-slug');

    await expect(getAdminChannelSettings(ctx)).rejects.toThrow(MainChannelNotApprovedError);

    vi.unstubAllEnvs();
  });

  itWithDb('kanał nie-primary zwraca błąd', async () => {
     const admin = await prisma.user.create({
        data: {
            id: 'admin-non-primary-id',
            email: 'admin-non-primary@example.com',
            role: 'ADMIN',
        }
    });

    await prisma.creator.create({
        data: {
            userId: admin.id,
            slug: 'non-primary-slug',
            name: 'Non Primary Channel',
            isApproved: true,
            isPrimary: false,
        }
    });

    const ctx = createAppContext({
        actor: { type: 'admin', userId: admin.id },
        prisma: prisma
    });

    vi.stubEnv('MAIN_CREATOR_SLUG', 'non-primary-slug');

    await expect(getAdminChannelSettings(ctx)).rejects.toThrow(MainChannelNotPrimaryError);

    vi.unstubAllEnvs();
  });

  itWithDb('odczytuje pole displaySubscribersCount', async () => {
    const admin = await prisma.user.create({
        data: {
            id: 'admin-sub-count-id',
            email: 'admin-sub-count@example.com',
            role: 'ADMIN',
        }
    });

    await prisma.creator.create({
        data: {
            userId: admin.id,
            slug: 'sub-count-slug',
            name: 'Sub Count Channel',
            isApproved: true,
            isPrimary: true,
            displaySubscribersCount: 1234,
            subscribersCount: 10,
        }
    });

    const ctx = createAppContext({
        actor: { type: 'admin', userId: admin.id },
        prisma: prisma
    });

    vi.stubEnv('MAIN_CREATOR_SLUG', 'sub-count-slug');

    const result = await getAdminChannelSettings(ctx);

    expect(result.displaySubscribersCount).toBe(1234);
    expect(result.subscribersCount).toBe(10);

    vi.unstubAllEnvs();
  });

  describe('Classification Logic', () => {
      it('klasyfikuje błąd braku kolumny (P2022)', () => {
          const p2022 = new Prisma.PrismaClientKnownRequestError('Column missing', { code: 'P2022', clientVersion: '6.x' });
          const classification = classifyAdminChannelError(p2022);
          expect(classification.code).toBe('DB_SCHEMA_MISMATCH');
          expect(classification.message).toContain('db:migrate:deploy');
      });

      it('klasyfikuje błąd połączenia', () => {
          const p1001 = new Prisma.PrismaClientKnownRequestError('Conn failed', { code: 'P1001', clientVersion: '6.x' });
          const classification = classifyAdminChannelError(p1001);
          expect(classification.code).toBe('DB_CONNECTION_ERROR');
      });
  });
});
