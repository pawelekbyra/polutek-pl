import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSnsConfig } from '@/lib/email-config';
import { handleSesEvent, isAllowedSnsUrl, verifySnsMessage } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getClientIp } from '@/lib/api/client-ip';
import { rateLimit } from '@/lib/rate-limit';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/utils/request-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** SNS messages are at most 256 KB. */
const MAX_SNS_BODY_BYTES = 262_144;
const SUBSCRIBE_TIMEOUT_MS = 5000;

/**
 * Amazon SNS HTTPS endpoint for SES bounce/complaint/delivery events (EMAIL_SES.md). Public by design (SNS has no
 * session), so EVERY message is verified cryptographically before anything happens: signature (v1/v2), signing
 * certificate host, and TopicArn against the SES_SNS_TOPIC_ARN allowlist. Unset allowlist = refuse everything.
 * SNS sends Content-Type text/plain with a JSON body, so the body is read as text.
 */
export async function POST(req: NextRequest) {
  const config = getSnsConfig();
  if (config.topicArns.length === 0) {
    logger.error('[ses-events] SES_SNS_TOPIC_ARN is not set; refusing SNS messages.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  try {
    const limited = await rateLimit({ key: `ses-sns:${getClientIp(req.headers)}`, limit: 600, windowMs: 60_000 });
    if (!limited.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  } catch (error) {
    // A broken limiter store must not drop bounce events; signature checks below still protect the endpoint.
    logger.warn('[ses-events] Rate limiter unavailable', error instanceof Error ? error.message : String(error));
  }

  let rawBody: string;
  try {
    rawBody = await readRequestTextWithLimit(req, MAX_SNS_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    throw error;
  }

  const verification = await verifySnsMessage(rawBody, { allowedTopicArns: config.topicArns, allowedRegions: config.regions });
  if (!verification.ok) {
    logger.warn(`[ses-events] Rejected: ${verification.reason}`);
    return NextResponse.json({ error: 'Invalid message' }, { status: verification.reason === 'cert_fetch_failed' ? 503 : 403 });
  }
  const message = verification.message;

  try {
    if (message.Type === 'SubscriptionConfirmation') {
      if (!isAllowedSnsUrl(message.SubscribeURL, config.regions, 'subscribe')) {
        logger.warn('[ses-events] Rejected: SubscribeURL host not allowed');
        return NextResponse.json({ error: 'Invalid message' }, { status: 403 });
      }
      const response = await fetch(message.SubscribeURL as string, { signal: AbortSignal.timeout(SUBSCRIBE_TIMEOUT_MS), redirect: 'error', cache: 'no-store' });
      if (!response.ok) {
        logger.error(`[ses-events] Subscription confirmation failed (HTTP ${response.status})`);
        return NextResponse.json({ error: 'Confirmation failed' }, { status: 502 });
      }
      logger.info(`[ses-events] Subscription confirmed for topic ${message.TopicArn}`);
      return NextResponse.json({ received: true, confirmed: true });
    }

    if (message.Type === 'UnsubscribeConfirmation') {
      logger.warn(`[ses-events] SNS unsubscribed this endpoint from topic ${message.TopicArn}; events will stop`);
      return NextResponse.json({ received: true });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(message.Message);
    } catch {
      logger.info('[ses-events] Ignored notification (message is not JSON)');
      return NextResponse.json({ received: true, ignored: true });
    }

    const ctx = createAppContext({ actor: { type: 'system', reason: 'SES SNS Webhook' } });
    const result = await handleSesEvent(ctx, { snsMessageId: message.MessageId, payload });
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: result.error.statusCode || 500 });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    // Database or network failure: 5xx makes SNS retry the delivery.
    logger.error('[ses-events] Processing failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
