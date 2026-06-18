import { createScopedLogger } from "@/lib/logger";
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { WebhookEventStatus } from '@prisma/client';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SyncUserFromWebhookUseCase } from '@/lib/modules/users';
import { acquireClerkEventLock } from '@/lib/webhooks/clerk-idempotency';
import { recordAlert, recordDurationMetric, recordMetric, startTimer } from '@/lib/observability';

type SupportedLanguage = 'pl' | 'en';
type ClerkPublicMetadata = {
  language?: unknown;
  preferredLanguage?: unknown;
  isPatron?: unknown;
  role?: unknown;
  totalPaid?: unknown;
};
type ClerkUnsafeMetadata = {
  referrerId?: unknown;
  language?: unknown;
  preferredLanguage?: unknown;
};

type ClerkUserWebhookData = {
  id?: string;
  email_addresses?: Array<{ email_address?: string }>;
  image_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  unsafe_metadata?: unknown;
  public_metadata?: unknown;
};

function getMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getUserWebhookData(data: unknown): ClerkUserWebhookData {
  return getMetadataObject(data) as ClerkUserWebhookData;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'pl' || value === 'en';
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveLanguage(publicMetadata: ClerkPublicMetadata, unsafeMetadata: ClerkUnsafeMetadata): SupportedLanguage {
  const candidates = [
    publicMetadata.language,
    publicMetadata.preferredLanguage,
    unsafeMetadata.language,
    unsafeMetadata.preferredLanguage,
  ];
  return candidates.find(isSupportedLanguage) || 'pl';
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(sk_(live|test)_[A-Za-z0-9_\-]+|whsec_[A-Za-z0-9_\-]+|Bearer\s+[A-Za-z0-9._\-]+)/g, '[redacted]').slice(0, 1000);
}

function getSafePayload(evt: WebhookEvent): any {
  const data = getMetadataObject(evt.data);
  return {
    type: evt.type,
    data: {
      id: getString(data.id),
      user_id: getString(data.user_id),
    },
  };
}

export async function POST(req: Request) {
  const startedAt = startTimer();
  const requestId = req.headers.get('svix-id') || crypto.randomUUID();
  const scopedLogger = createScopedLogger(requestId);
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    scopedLogger.error('Error verifying webhook:', err);
    recordDurationMetric('clerk.webhook.processing_time', startedAt, { status: 'verification_failed' }, { level: 'error', alert: true });
    return new Response('Error occured', { status: 400 });
  }

  const lock = await acquireClerkEventLock(svix_id, evt.type, getSafePayload(evt));
  if (!lock.acquired) {
    scopedLogger.info(`[ClerkWebhook] Event ${svix_id} already received or processing.`);
    recordMetric('clerk.webhook.duplicate_or_processing', { eventType: evt.type, duplicate: lock.duplicate, processing: lock.processing });
    return NextResponse.json({
      success: true,
      duplicate: lock.duplicate,
      processing: lock.processing
    });
  }

  const ctx = createAppContext({ actor: { type: 'system', reason: 'clerk_webhook' } });

  try {
    const eventType: string = evt.type;

    if (eventType === 'user.created' || eventType === 'user.updated') {
      const userData = getUserWebhookData(evt.data);
      const { id, email_addresses = [], image_url, first_name, last_name, username } = userData;
      const unsafeMetadata = getMetadataObject(userData.unsafe_metadata) as ClerkUnsafeMetadata;
      const publicMetadata = getMetadataObject(userData.public_metadata) as ClerkPublicMetadata;
      const email = email_addresses[0]?.email_address;
      const firstLast = `${first_name || ''} ${last_name || ''}`.trim();
      const displayUsername = isGeneratedClerkUsername(username) ? null : username;
      const name = (firstLast && !isGeneratedClerkUsername(firstLast) ? firstLast : null) || displayUsername;
      const referrerId = getString(unsafeMetadata.referrerId);
      const userLanguage = resolveLanguage(publicMetadata, unsafeMetadata);

      if (id && email) {
        await SyncUserFromWebhookUseCase.execute(ctx, {
            id,
            email,
            name,
            username: username || undefined,
            imageUrl: image_url,
            language: userLanguage,
            referrerId
        }, eventType);
        scopedLogger.info(`User ${id} synced via webhook. Type: ${eventType}`);
      }
    }

    if (eventType === 'user.deleted') {
        const { id } = evt.data;
        if (id) {
            await SyncUserFromWebhookUseCase.softDelete(ctx, id);
            scopedLogger.info(`User ${id} soft-deleted via webhook.`);
        }
    }

    if (eventType === 'password.updated') {
        const data = getMetadataObject(evt.data);
        const userId = getString(data.user_id);
        if (userId) {
            await SyncUserFromWebhookUseCase.updatePassword(ctx, userId);
            scopedLogger.info(`User ${userId} password change handled.`);
        }
    }

    await SyncUserFromWebhookUseCase.finalizeEvent(ctx, svix_id, WebhookEventStatus.PROCESSED);

    scopedLogger.info(`[ClerkWebhook] Event ${svix_id} (${evt.type}) PROCESSED successfully.`);
    recordDurationMetric('clerk.webhook.processing_time', startedAt, { eventType: evt.type, status: 'processed' });
    return NextResponse.json({ success: true });
  } catch (error) {
    scopedLogger.error(`[ClerkWebhook] Error handling event ${svix_id}:`, error);
    recordAlert('clerk.webhook.failed', { eventType: evt.type });
    recordDurationMetric('clerk.webhook.processing_time', startedAt, { eventType: evt.type, status: 'failed' }, { level: 'error', alert: true });

    await SyncUserFromWebhookUseCase.finalizeEvent(ctx, svix_id, WebhookEventStatus.FAILED, safeErrorMessage(error));

    return NextResponse.json({ success: false }, { status: 500 });
  }
}
