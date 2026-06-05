import { logger } from "@/lib/logger";
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { EmailService } from '@/lib/services/email.service';
import { prisma } from '@/lib/prisma';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import { acquireClerkEventLock } from '@/lib/webhooks/clerk-idempotency';

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

function getUserWebhookData(data: unknown): ClerkUserWebhookData {
  return getMetadataObject(data) as ClerkUserWebhookData;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'pl' || value === 'en';
}

function getMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

function getSafePayload(evt: WebhookEvent): Prisma.InputJsonValue {
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
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  const headerPayload = headers();
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
    logger.error('Error verifying webhook:', err);
    return new Response('Error occured', { status: 400 });
  }

  const lock = await acquireClerkEventLock(svix_id, evt.type, getSafePayload(evt));
  if (!lock.acquired) {
    logger.info(`[ClerkWebhook] Event ${svix_id} already received or processing.`);
    return NextResponse.json({
      success: true,
      duplicate: lock.duplicate,
      processing: lock.processing
    });
  }

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
        const user = await UserService.syncUser(id, email, name, image_url, referrerId, userLanguage, username || undefined);
        logger.info(`User ${id} synced via webhook. Referrer: ${referrerId || 'None'}, Language: ${userLanguage}`);

        if (eventType === 'user.created') {
          logger.info(`[ClerkWebhook] New user created: ${email}. Triggering welcome email.`);
          try {
            await EmailService.sendWelcomeEmail(email, first_name || name || undefined, userLanguage);
          } catch (error) {
            logger.error('[ClerkWebhook] Failed to send welcome email:', error);
          }
        }
      }
    }

    if (eventType === 'user.deleted') {
        const { id } = evt.data;
        if (id) {
            // Try to find user before soft-deleting to get their email and language
            const user = await prisma.user.findUnique({
                where: { id },
                select: { email: true, language: true }
            });

            if (user) {
                await UserService.softDeleteUser(id);
                logger.info(`User ${id} soft-deleted/anonymized via webhook.`);
            }

            if (user && user.email && !user.email.startsWith('deleted_')) {
                await EmailService.sendAccountDeletedEmail(user.email);
            }
        }
    }

    // Use the dedicated password update event if configured in Clerk
    if (eventType === 'password.updated') {
        const data = getMetadataObject(evt.data);
        const userId = getString(data.user_id);
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, language: true }
            });
            if (user?.email) {
                await EmailService.sendPasswordChangedEmail(user.email);
            }
        }
    }

    await prisma.clerkEvent.update({
      where: { id: svix_id },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        error: null,
      },
    });

    logger.info(`[ClerkWebhook] Event ${svix_id} (${evt.type}) PROCESSED successfully.`);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`[ClerkWebhook] Error handling event ${svix_id}:`, error);
    await prisma.clerkEvent.update({
      where: { id: svix_id },
      data: {
        status: WebhookEventStatus.FAILED,
        error: safeErrorMessage(error),
      },
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
