import { prisma } from '@/lib/prisma';
import { WebhookEventStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { recordMetric, recordAlert } from '@/lib/observability';
import { DbClient } from '../../shared/db';
import { isPrismaErrorCode } from '@/lib/utils/db';

const EMAIL_STALE_MS = 10 * 60_000;

export class EmailEventLockService {
  constructor(private readonly db: { read: DbClient; write: DbClient } = { read: prisma, write: prisma }) {}

  async acquireLock(event: { providerEventId: string; type: string; payload: any }): Promise<'ACQUIRED' | 'ALREADY_PROCESSED' | 'CONFLICT'> {
    try {
      await this.db.write.emailEvent.create({
        data: {
          providerEventId: event.providerEventId,
          type: event.type,
          status: WebhookEventStatus.PROCESSING,
          payload: event.payload
        }
      });
      logger.info(`[EmailEventLock] Lock acquired: ${event.providerEventId} type=${event.type}`);
      recordMetric('email.webhook.lock_acquired', { eventType: event.type });
      return 'ACQUIRED';
    } catch (e: unknown) {
      if (isPrismaErrorCode(e, 'P2002')) {
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - EMAIL_STALE_MS);

        // Try to recover from FAILED or STALE PROCESSING
        const { count } = await this.db.write.emailEvent.updateMany({
          where: {
            providerEventId: event.providerEventId,
            OR: [
              { status: WebhookEventStatus.FAILED },
              { status: WebhookEventStatus.PROCESSING, updatedAt: { lt: staleThreshold } }
            ]
          },
          data: {
            status: WebhookEventStatus.PROCESSING,
            updatedAt: now,
            error: null,
            type: event.type, // Ensure type matches on recovery
            payload: event.payload
          }
        });

        if (count > 0) {
          logger.info(`[EmailEventLock] Lock re-acquired: ${event.providerEventId} (previous stale/failed)`);
          return 'ACQUIRED';
        }

        const existing = await this.db.read.emailEvent.findUnique({ where: { providerEventId: event.providerEventId } });

        if (!existing) {
            // Edge case: P2002 happened but row is gone (race condition in cleanup?)
            logger.warn(`[EmailEventLock] P2002 encountered but row missing for ${event.providerEventId}. Retrying insert.`);
            return this.acquireLock(event);
        }

        if (existing.type !== event.type) {
            logger.error(`[EmailEventLock] Mismatched event type for ${event.providerEventId}. Existing: ${existing.type}, New: ${event.type}`);
            // This is an inconsistent state, return CONFLICT to be safe
            return 'CONFLICT';
        }

        if (existing.status === WebhookEventStatus.PROCESSED) {
          logger.info(`[EmailEventLock] Duplicate PROCESSED event: ${event.providerEventId}`);
          recordMetric('email.webhook.duplicate_event', { eventType: event.type, status: existing.status });
          return 'ALREADY_PROCESSED';
        } else {
          logger.info(`[EmailEventLock] Lock conflict: ${event.providerEventId} status=${existing.status}`);
          recordAlert('email.webhook.lock_conflict', { eventType: event.type, status: existing.status });
          return 'CONFLICT';
        }
      }
      throw e;
    }
  }

  async releaseWithSuccess(providerEventId: string, metadata: { resendEmailId?: string; broadcastEmailId?: string; email?: string; recipientId?: string } = {}): Promise<void> {
    await this.db.write.emailEvent.update({
      where: { providerEventId },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        ...metadata
      }
    });
  }

  async releaseWithFailure(providerEventId: string, error: string): Promise<void> {
    await this.db.write.emailEvent.update({
      where: { providerEventId },
      data: {
        status: WebhookEventStatus.FAILED,
        error: error
      }
    });
  }
}
