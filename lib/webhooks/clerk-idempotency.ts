import { WebhookEventStatus } from '@prisma/client';

const CLERK_PROCESSING_TIMEOUT_MS = 5 * 60_000;

type ExistingClerkEvent = {
  status: WebhookEventStatus;
  updatedAt: Date;
} | null;

export function shouldProcessClerkEvent(existingEvent: ExistingClerkEvent, now = new Date()) {
  if (!existingEvent) return true;
  if (existingEvent.status === WebhookEventStatus.PROCESSED) return false;
  if (existingEvent.status === WebhookEventStatus.FAILED) return true;
  if (existingEvent.status === WebhookEventStatus.PROCESSING) {
    return now.getTime() - existingEvent.updatedAt.getTime() >= CLERK_PROCESSING_TIMEOUT_MS;
  }
  return true;
}
