import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { WebhookEventStatus } from '@prisma/client';
import { EmailEventLockService } from '@/lib/modules/email/infrastructure/email-event-lock.service';

/**
 * Integration test for EmailEventLockService.
 * Requires a running PostgreSQL database.
 * Run locally with a real DB or in CI.
 */
describe('EmailEventLockService - Real DB Idempotency', () => {
  const lockService = new EmailEventLockService({ read: prisma, write: prisma });

  beforeEach(async () => {
    try {
        await prisma.emailEvent.deleteMany({
            where: { providerEventId: { startsWith: 'test_evt_' } }
        });
    } catch (e) {
        if (process.env.RUN_INTEGRATION_TESTS === 'true') {
            console.error('CRITICAL: Integration tests requested but database connection failed.');
            throw e;
        }
        console.warn('Skipping Real DB test - connection failed');
    }
  });

  const itWithDb = process.env.RUN_INTEGRATION_TESTS === 'true' ? it : it.skip;

  itWithDb('enforces atomic idempotency via unique constraint', async () => {
    const providerEventId = 'test_evt_1';
    const type = 'email.sent';
    const payload = { test: true };

    const status1 = await lockService.acquireLock({ providerEventId, type, payload });
    expect(status1).toBe('ACQUIRED');

    const status2 = await lockService.acquireLock({ providerEventId, type, payload });
    expect(status2).toBe('CONFLICT');

    await lockService.releaseWithSuccess(providerEventId);

    const status3 = await lockService.acquireLock({ providerEventId, type, payload });
    expect(status3).toBe('ALREADY_PROCESSED');
  });

  itWithDb('allows re-acquiring failed events', async () => {
    const providerEventId = 'test_evt_fail';
    const type = 'email.sent';

    await lockService.acquireLock({ providerEventId, type, payload: {} });
    await lockService.releaseWithFailure(providerEventId, 'Some error');

    const status = await lockService.acquireLock({ providerEventId, type, payload: {} });
    expect(status).toBe('ACQUIRED');

    const event = await prisma.emailEvent.findUnique({ where: { providerEventId } });
    expect(event?.status).toBe(WebhookEventStatus.PROCESSING);
    expect(event?.error).toBeNull();
  });
});
