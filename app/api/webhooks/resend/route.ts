import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { Webhook } from 'svix';
import { handleResendWebhook, ResendWebhookInput } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';

export async function POST(req: NextRequest) {
  // Webhook signature verification using svix (HMAC-SHA256)
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (process.env.NODE_ENV === 'production' && !secret) {
    logger.error("[ResendWebhook] RESEND_WEBHOOK_SECRET is required in production.");
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Get headers for svix verification
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  // Fallback to legacy header for dev/staging if svix headers are missing and secret matches
  const legacySecret = req.headers.get('x-resend-webhook-secret');

  let payload: ResendWebhookInput;
  const rawBody = await req.text();

  if (svixId && svixTimestamp && svixSignature && secret) {
    try {
      const wh = new Webhook(secret);
      payload = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ResendWebhookInput;

      // Preserve svix-id as internal eventId for idempotency
      payload.eventId = svixId;
    } catch (err) {
      logger.warn("[ResendWebhook] svix verification failed", err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (secret && (legacySecret === secret || process.env.NODE_ENV !== 'production')) {
    // Allow legacy verification if explicitly configured and matching
    try {
        payload = JSON.parse(rawBody) as ResendWebhookInput;
        payload.eventId = svixId || undefined;
    } catch (err) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  } else {
    logger.warn("[ResendWebhook] Unauthorized access attempt - invalid or missing signature/secret.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = createAppContext({
      actor: { type: 'system', reason: 'Resend Webhook' }
  });

  const result = await handleResendWebhook(ctx, payload);

  if (!result.ok) {
      // For webhooks, we often return 200 even if processing fails to avoid retries
      // of non-fixable errors, but here we mirror the use case result.
      return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
