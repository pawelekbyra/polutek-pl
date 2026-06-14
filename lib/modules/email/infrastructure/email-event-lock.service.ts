import { prisma } from '@/lib/prisma';
import { WebhookEventStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { recordMetric, recordAlert } from '@/lib/observability';
import { DbClient } from '../../shared/db';
import { isPrismaErrorCode } from '@/lib/utils/db';

const EMAIL_STALE_MS = 10 * 60_000;

export class EmailEventLockService {
  constructor(private readonly db: { read: DbClient; write: DbClient } = { read: prisma, write: prisma }) {}

  async acquireLock(event: { providerEventId: string; type: string; payload: any }, attempt = 1): Promise<'ACQUIRED' | 'ALREADY_PROCESSED' | 'CONFLICT'> {
    try {
      await this.db.write.emailEvent.create({
        data: {
          providerEventId: event.providerEventId,
          type: event.type,
          status: WebhookEventStatus.PROCESSING,
          payload: event.payload
        }
      });
      logger.info(`[EmailEventLock] Lock acquired: ${event.providerEventId} (${event.type})`);
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
          data: { status: WebhookEventStatus.PROCESSING, updatedAt: now, error: null }
        });

        if (count > 0) {
          logger.info(`[EmailEventLock] Lock re-acquired: ${event.providerEventId} (stale/failed)`);
          return 'ACQUIRED';
        }

        const existing = await this.db.read.emailEvent.findUnique({ where: { providerEventId: event.providerEventId } });

        if (!existing) {
            if (attempt < 2) {
                // Rare race: P2002 but row gone (Cleanup? Manual deletion?). Bounded retry.
                logger.warn(`[EmailEventLock] P2002 but row missing for ${event.providerEventId}. Bounded retry.`);
                return this.acquireLock(event, attempt + 1);
            }
            throw new Error(`Database consistency error: unique constraint violation but row missing for ${event.providerEventId}`);
        }

        if (existing.type !== event.type) {
            logger.error(`[EmailEventLock] Mismatched event type for ${event.providerEventId}. Expected: ${existing.type}, Received: ${event.type}`);
            return 'CONFLICT'; // Treat as conflict to be safe and avoid processing wrong payload
        }

        if (existing.status === WebhookEventStatus.PROCESSED) {
          logger.info(`[EmailEventLock] Event ${event.providerEventId} already PROCESSED.`);
          recordMetric('email.webhook.duplicate_event', { eventType: event.type, status: existing.status });
          return 'ALREADY_PROCESSED';
        } else {
          logger.info(`[EmailEventLock] Lock conflict: ${event.providerEventId} Status: ${existing.status}.`);
          recordAlert('email.webhook.lock_conflict', { eventType: event.type, status: existing.status });
          return 'CONFLICT';
        }
      }
      throw e;
    }
  }

  async releaseWithSuccess(providerEventId: string, metadata: { resendEmailId?: string; broadcastEmailId?: string; email?: string } = {}): Promise<void> {
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
