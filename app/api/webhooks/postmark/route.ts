import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkBasicAuth, handleResendWebhook, normalizePostmarkEvent } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/utils/request-body';

const MAX_BODY_BYTES = 100_000;

/**
 * Postmark delivery, bounce and spam-complaint webhook. Postmark does not sign requests, so the webhook URL
 * carries HTTP Basic credentials (POSTMARK_WEBHOOK_USER / POSTMARK_WEBHOOK_PASSWORD) that are checked here.
 * The events are handled by the same use case as Resend's (recipient status, suppression, idempotency).
 */
export async function POST(req: NextRequest) {
  const user = process.env.POSTMARK_WEBHOOK_USER?.trim();
  const password = process.env.POSTMARK_WEBHOOK_PASSWORD?.trim();
  if (!user || !password) {
    logger.error('[PostmarkWebhook] POSTMARK_WEBHOOK_USER / POSTMARK_WEBHOOK_PASSWORD are not set; refusing webhooks.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!checkBasicAuth(req.headers.get('authorization'), user, password)) {
    logger.warn('[PostmarkWebhook] Rejected: missing or wrong basic credentials.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: string;
  try {
    rawBody = await readRequestTextWithLimit(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = normalizePostmarkEvent(json);
  if (!event) return NextResponse.json({ received: true, accepted: true, ignored: true });

  const ctx = createAppContext({ actor: { type: 'system', reason: 'Postmark Webhook' } });
  const result = await handleResendWebhook(ctx, event);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: result.error.statusCode || 500 });
  }
  return NextResponse.json(result.data);
}
