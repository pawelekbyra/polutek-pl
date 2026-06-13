import { prisma } from '@/lib/prisma';
import { WebhookEventStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { recordMetric, recordAlert } from '@/lib/observability';
import { ReadDb, WriteTx } from '../../shared/db';

const EMAIL_STALE_MS = 10 * 60_000;

export class EmailEventLockService {
  constructor(private readonly db: { read: ReadDb; write: WriteTx } = { read: prisma, write: prisma }) {}

  async acquireLock(event: { providerEventId: string; type: string; payload: any }): Promise<'ACQUIRED' | 'ALREADY_PROCESSED' | 'CONFLICT'> {
    try {
      await (this.db.write as any).emailEvent.create({
        data: {
          providerEventId: event.providerEventId,
          type: event.type,
          status: WebhookEventStatus.PROCESSING,
          payload: event.payload
        }
      });
      logger.info(`[EmailEventLock] Lock acquired for new event: ${event.providerEventId} (${event.type})`);
      recordMetric('email.webhook.lock_acquired', { eventType: event.type });
      return 'ACQUIRED';
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - EMAIL_STALE_MS);

        // Try to recover from FAILED or STALE PROCESSING
        const { count } = await (this.db.write as any).emailEvent.updateMany({
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
          logger.info(`[EmailEventLock] Lock re-acquired for event: ${event.providerEventId} (stale or failed previously)`);
          return 'ACQUIRED';
        }

        const existing = await (this.db.read as any).emailEvent.findUnique({ where: { providerEventId: event.providerEventId } });
        if (existing?.status === WebhookEventStatus.PROCESSED) {
          logger.info(`[EmailEventLock] Event ${event.providerEventId} (${event.type}) already PROCESSED.`);
          recordMetric('email.webhook.duplicate_event', { eventType: event.type, status: existing.status });
          return 'ALREADY_PROCESSED';
        } else {
          logger.info(`[EmailEventLock] Event ${event.providerEventId} (${event.type}) lock conflict. Status: ${existing?.status}.`);
          recordAlert('email.webhook.lock_conflict', { eventType: event.type, status: existing?.status || 'unknown' });
          return 'CONFLICT';
        }
      }
      throw e;
    }
  }

  async releaseWithSuccess(providerEventId: string, metadata: { resendEmailId?: string; broadcastEmailId?: string; email?: string } = {}): Promise<void> {
    await (this.db.write as any).emailEvent.update({
      where: { providerEventId },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        ...metadata
      }
    });
  }

  async releaseWithFailure(providerEventId: string, error: string): Promise<void> {
    await (this.db.write as any).emailEvent.update({
      where: { providerEventId },
      data: {
        status: WebhookEventStatus.FAILED,
        error: error
      }
    });
  }
}
