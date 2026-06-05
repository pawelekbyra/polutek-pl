import { prisma } from '@/lib/prisma';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

export const CLERK_STALE_MS = 5 * 60_000;

type ExistingClerkEvent = {
  status: WebhookEventStatus;
  updatedAt: Date;
} | null;

export function shouldProcessClerkEvent(existingEvent: ExistingClerkEvent, now = new Date()) {
  if (!existingEvent) return true;
  if (existingEvent.status === WebhookEventStatus.PROCESSED) return false;
  if (existingEvent.status === WebhookEventStatus.FAILED) return true;
  if (existingEvent.status === WebhookEventStatus.PROCESSING) {
    return now.getTime() - existingEvent.updatedAt.getTime() >= CLERK_STALE_MS;
  }
  return true;
}

export async function acquireClerkEventLock(id: string, type: string, payload: Prisma.InputJsonValue) {
  try {
    // 1. Try to create the event record as PROCESSING
    await prisma.clerkEvent.create({
      data: {
        id,
        type,
        status: WebhookEventStatus.PROCESSING,
        payload,
      }
    });
    return { success: true, acquired: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      // 2. If it already exists, check if it's stale or FAILED
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - CLERK_STALE_MS);

      const { count } = await prisma.clerkEvent.updateMany({
        where: {
          id,
          OR: [
            { status: WebhookEventStatus.FAILED },
            {
              status: WebhookEventStatus.PROCESSING,
              updatedAt: { lt: staleThreshold }
            }
          ]
        },
        data: {
          status: WebhookEventStatus.PROCESSING,
          updatedAt: now,
          error: null,
          payload,
        }
      });

      if (count > 0) {
        logger.info(`[ClerkWebhook] Reclaimed lock for event ${id} (status was FAILED or STALE).`);
        return { success: true, acquired: true };
      }

      // 3. If no rows updated, it means it's either PROCESSED or a fresh PROCESSING
      const existing = await prisma.clerkEvent.findUnique({
        where: { id },
        select: { status: true }
      });

      return {
        success: true,
        acquired: false,
        duplicate: existing?.status === WebhookEventStatus.PROCESSED,
        processing: existing?.status === WebhookEventStatus.PROCESSING,
      };
    }

    throw error;
  }
}
