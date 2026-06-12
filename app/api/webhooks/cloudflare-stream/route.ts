import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { handleCloudflareStreamWebhook } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/utils/correlation';
import { verifyCloudflareStreamWebhookSignature } from '@/lib/security/cloudflare-stream-webhook';

const ROUTE_NAME = 'CloudflareStreamWebhookRoute';
const SUPPORTED_CLOUDFLARE_STATES = new Set([
  'pendingupload',
  'downloading',
  'queued',
  'processing',
  'ready',
  'error',
]);

interface SanitizedCloudflareStreamWebhookPayload {
  uid: string;
  status: {
    state: 'pendingupload' | 'downloading' | 'queued' | 'processing' | 'ready' | 'error';
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
}

export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || 'cf-stream-webhook';
  const scopedLogger = createScopedLogger(ROUTE_NAME);
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;

  if (process.env.NODE_ENV === 'production' && !secret) {
    scopedLogger.error('Cloudflare Stream webhook verification is not configured.', {
      requestId,
      route: ROUTE_NAME,
      category: 'configuration_failure',
    });
    return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 });
  }

  const signatureHeader = req.headers.get('Webhook-Signature');
  const rawBody = await req.text();
  const verification = verifyCloudflareStreamWebhookSignature({
    secret,
    signatureHeader,
    rawBody,
  });

  if (!verification.ok) {
    scopedLogger.warn('Rejected Cloudflare Stream webhook before payload parsing.', {
      requestId,
      route: ROUTE_NAME,
      category: 'unauthorized_webhook',
    });
    return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    scopedLogger.warn('Rejected authenticated Cloudflare Stream webhook with invalid JSON.', {
      requestId,
      route: ROUTE_NAME,
      category: 'invalid_json',
    });
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  const payload = sanitizeCloudflareStreamWebhookPayload(parsedPayload);
  if (!payload) {
    scopedLogger.warn('Rejected authenticated Cloudflare Stream webhook with invalid payload shape.', {
      requestId,
      route: ROUTE_NAME,
      category: 'invalid_payload',
    });
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  try {
    const ctx = createAppContext({ requestId, actor: { type: 'system', reason: 'Cloudflare Stream Webhook' } });
    const result = await handleCloudflareStreamWebhook(payload, ctx);

    if (!result.ok) {
      return handleApiError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    scopedLogger.error('Cloudflare Stream webhook application error.', {
      requestId,
      route: ROUTE_NAME,
      category: 'application_error',
    });
    return handleApiError(err);
  }
}

function sanitizeCloudflareStreamWebhookPayload(payload: unknown): SanitizedCloudflareStreamWebhookPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const uid = payload.uid;
  const status = payload.status;

  if (typeof uid !== 'string' || uid.trim().length === 0 || !isRecord(status)) {
    return null;
  }

  const state = status.state;
  if (typeof state !== 'string' || state.trim().length === 0 || !SUPPORTED_CLOUDFLARE_STATES.has(state)) {
    return null;
  }

  const sanitizedStatus: SanitizedCloudflareStreamWebhookPayload['status'] = { state: state as SanitizedCloudflareStreamWebhookPayload['status']['state'] };

  if (typeof status.pctComplete === 'string') {
    sanitizedStatus.pctComplete = status.pctComplete;
  }

  if (typeof status.errorReasonCode === 'string') {
    sanitizedStatus.errorReasonCode = status.errorReasonCode;
  }

  if (typeof status.errorReasonText === 'string') {
    sanitizedStatus.errorReasonText = status.errorReasonText;
  }

  return {
    uid,
    status: sanitizedStatus,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
