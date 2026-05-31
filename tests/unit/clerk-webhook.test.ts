import { describe, expect, it } from 'vitest';
import { WebhookEventStatus } from '@prisma/client';
import { shouldProcessClerkEvent } from '@/lib/webhooks/clerk-idempotency';

describe('Clerk webhook idempotency decisions', () => {
  const now = new Date('2026-05-31T12:00:00Z');

  it('processes missing events', () => {
    expect(shouldProcessClerkEvent(null, now)).toBe(true);
  });

  it('does not process already processed events', () => {
    expect(shouldProcessClerkEvent({ status: WebhookEventStatus.PROCESSED, updatedAt: now }, now)).toBe(false);
  });

  it('allows failed events to retry', () => {
    expect(shouldProcessClerkEvent({ status: WebhookEventStatus.FAILED, updatedAt: now }, now)).toBe(true);
  });

  it('does not process fresh processing events in parallel', () => {
    expect(shouldProcessClerkEvent({
      status: WebhookEventStatus.PROCESSING,
      updatedAt: new Date(now.getTime() - 60_000),
    }, now)).toBe(false);
  });

  it('processes stale processing events', () => {
    expect(shouldProcessClerkEvent({
      status: WebhookEventStatus.PROCESSING,
      updatedAt: new Date(now.getTime() - 6 * 60_000),
    }, now)).toBe(true);
  });
});
