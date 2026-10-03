import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { handleResendWebhook, verifyResendWebhook, ResendWebhookInput } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/utils/request-body';

const MAX_RESEND_WEBHOOK_BODY_BYTES = 100_000;

/**
 * Resend delivery webhook. Every request must carry a valid Svix signature made with the signing
 * secret of this endpoint (RESEND_WEBHOOK_SECRET). Rejections are logged with the reason and safe
 * diagnostics (see verifyResendWebhook), so a wrong or mangled secret is visible in the logs.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    logger.error('[ResendWebhook] RESEND_WEBHOOK_SECRET is not set; refusing webhooks.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await readRequestTextWithLimit(req, MAX_RESEND_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      logger.warn('[ResendWebhook] Request body is too large.');
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    throw error;
  }

  const id = req.headers.get('svix-id');
  const timestamp = req.headers.get('svix-timestamp');
  const signature = req.headers.get('svix-signature');
  if (!id || !timestamp || !signature) {
    logger.warn('[ResendWebhook] Rejected: missing svix-id/svix-timestamp/svix-signature header.', {
      hasId: Boolean(id),
      hasTimestamp: Boolean(timestamp),
      hasSignature: Boolean(signature),
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const verification = verifyResendWebhook({ rawBody, headers: { id, timestamp, signature }, secret });
  if (!verification.ok) {
    if (verification.reason === 'secret_invalid') {
      logger.error(`[ResendWebhook] Rejected: ${verification.reason}`, verification.diagnostics);
    } else {
      logger.warn(`[ResendWebhook] Rejected: ${verification.reason}`, verification.diagnostics);
    }
    const status = verification.reason === 'secret_invalid' ? 500 : 401;
    return NextResponse.json({ error: status === 500 ? 'Webhook not configured' : 'Invalid signature' }, { status });
  }

  const payload = verification.payload as ResendWebhookInput;
  // svix-id is the delivery id: the same event retried by Resend keeps it (idempotency key).
  payload.eventId = id;

  const ctx = createAppContext({
    actor: { type: 'system', reason: 'Resend Webhook' },
  });

  const result = await handleResendWebhook(ctx, payload);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status: result.error.statusCode || 500 },
    );
  }

  return NextResponse.json(result.data);
}
