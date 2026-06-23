import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { Webhook } from 'svix';
import { handleResendWebhook, ResendWebhookInput } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/utils/request-body';

const SVIX_HEADER_NAMES = ['svix-id', 'svix-timestamp', 'svix-signature'] as const;
const MAX_RESEND_WEBHOOK_BODY_BYTES = 100_000;

function hasAnySvixHeader(req: NextRequest) {
  return SVIX_HEADER_NAMES.some((header) => req.headers.has(header));
}

function getCompleteSvixHeaders(req: NextRequest) {
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return null;
  }

  return {
    svixId,
    svixTimestamp,
    svixSignature,
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const isTestRuntime = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  const allowDevSecretAuth = process.env.RESEND_WEBHOOK_DEV_SECRET_AUTH === 'true' || isTestRuntime;

  if (isProduction && !secret) {
    logger.error('[ResendWebhook] RESEND_WEBHOOK_SECRET is required in production.');
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

  const svixHeaders = getCompleteSvixHeaders(req);
  const containsSvixHeader = hasAnySvixHeader(req);

  let payload: ResendWebhookInput;

  if (svixHeaders && secret) {
    try {
      const wh = new Webhook(secret);
      payload = wh.verify(rawBody, {
        'svix-id': svixHeaders.svixId,
        'svix-timestamp': svixHeaders.svixTimestamp,
        'svix-signature': svixHeaders.svixSignature,
      }) as ResendWebhookInput;

      // Preserve svix-id as internal eventId for idempotency.
      payload.eventId = svixHeaders.svixId;
    } catch {
      logger.warn('[ResendWebhook] Svix verification failed.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (containsSvixHeader) {
    logger.warn('[ResendWebhook] Incomplete Svix header set.');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  } else if (!isProduction && allowDevSecretAuth && secret && req.headers.get('x-resend-webhook-secret') === secret) {
    try {
      payload = JSON.parse(rawBody) as ResendWebhookInput;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }
  } else {
    logger.warn('[ResendWebhook] Unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = createAppContext({
    actor: { type: 'system', reason: 'Resend Webhook' },
  });

  const result = await handleResendWebhook(ctx, payload);

  if (!result.ok) {
    const status = result.error.statusCode || 500;

    return NextResponse.json(
      {
        error: result.error.message,
        code: result.error.code,
      },
      { status },
    );
  }

  return NextResponse.json(result.data);
}
