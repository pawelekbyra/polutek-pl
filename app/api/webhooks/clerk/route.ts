import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { EmailService } from '@/lib/services/email.service';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors';

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

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', { status: 400 });
  }

  const eventId = svix_id;
  const eventType = evt.type;

  // Idempotency check
  const existingEvent = await prisma.clerkEvent.findUnique({
    where: { id: eventId }
  });

  if (existingEvent?.processedAt) {
    console.log(`[ClerkWebhook] Event ${eventId} already processed.`);
    return NextResponse.json({ success: true, duplicated: true });
  }

  try {
    // Record event before processing
    await prisma.clerkEvent.upsert({
      where: { id: eventId },
      create: { id: eventId, type: eventType },
      update: {}
    });

    if (eventType === 'user.created' || eventType === 'user.updated') {
        const { id, email_addresses, image_url, first_name, last_name, username, unsafe_metadata, public_metadata } = evt.data;
        const email = email_addresses[0]?.email_address;
        const name = `${first_name || ''} ${last_name || ''}`.trim() || null;
        const referrerId = unsafe_metadata?.referrerId as string | undefined;

        // Extract language from metadata (public takes precedence, then unsafe, then default 'en')
        const userLanguage = (public_metadata?.language || public_metadata?.preferredLanguage || unsafe_metadata?.language || unsafe_metadata?.preferredLanguage || 'en') as string;

        if (id && email) {
        const user = await UserService.syncUser(id, email, name, image_url, referrerId, userLanguage, username);
        console.log(`User ${id} synced via webhook. Referrer: ${referrerId || 'None'}, Language: ${userLanguage}`);

        if (eventType === 'user.created') {
            console.log(`[ClerkWebhook] New user created: ${email}. Triggering welcome email.`);
            // Send welcome email without blocking Clerk webhook delivery.
            EmailService.sendWelcomeEmail(email, user.language as 'pl' | 'en' || 'pl').catch((error) => {
            console.error('[ClerkWebhook] Failed to send welcome email:', error);
            });
        }
        }
    }

    if (eventType === 'user.deleted') {
        const { id } = evt.data;
        if (id) {
            try {
                // Try to find user before soft-deleting to get their email and language
                const user = await prisma.user.findUnique({
                    where: { id },
                    select: { email: true, language: true }
                });

                if (user) {
                    await UserService.softDeleteUser(id);
                    console.log(`User ${id} soft-deleted/anonymized via webhook.`);
                }

                if (user && user.email && !user.email.startsWith('deleted_')) {
                    await EmailService.sendAccountDeletedEmail(user.email, user.language as 'pl' | 'en' || 'pl');
                }
            } catch (e) {
                console.error(`Error soft-deleting user ${id}:`, e);
            }
        }
    }

    // Use the dedicated password update event if configured in Clerk
    if (eventType as string === 'password.updated') {
        const data = evt.data as any;
        const userId = data.user_id;
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, language: true }
            });
            if (user?.email) {
                await EmailService.sendPasswordChangedEmail(user.email, user.language as 'pl' | 'en' || 'pl');
            }
        }
    }

    // Mark as processed
    await prisma.clerkEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
      console.error(`[ClerkWebhook] Error processing event ${eventId}:`, error);
      return handleApiError(error);
  }
}
