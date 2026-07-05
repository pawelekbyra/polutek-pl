import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/utils/correlation';
import { verifyCloudflareStreamWebhookSignature } from '@/lib/security/cloudflare-stream-webhook';
import { normalizeCloudflareStreamWebhook } from '@/lib/modules/video/infrastructure/provider-webhook-mappers';
import { VideoProviderWebhookService } from '@/lib/modules/video/application/video-provider-webhook.service';

const ROUTE_NAME = 'CloudflareStreamWebhookRoute';

export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || 'cf-stream-webhook';
  const scopedLogger = createScopedLogger(ROUTE_NAME);
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 });
  const rawBody = await req.text();
  const verification = verifyCloudflareStreamWebhookSignature({ secret, signatureHeader: req.headers.get('Webhook-Signature'), rawBody });
  if (!verification.ok) {
    scopedLogger.warn('Cloudflare Stream webhook signature verification failed.', { requestId, route: ROUTE_NAME, category: 'unauthorized_webhook' });
    return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
  }
  let parsedPayload: unknown;
  try { parsedPayload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 }); }
  try {
    const normalized = normalizeCloudflareStreamWebhook(parsedPayload);
    const ctx = createAppContext({ requestId, actor: { type: 'system', reason: 'Cloudflare Stream Webhook' } });
    const result = await new VideoProviderWebhookService().ingestProviderWebhook({ ...normalized, payload: normalized.raw }, ctx);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    scopedLogger.error('Cloudflare Stream webhook application error.', { requestId, route: ROUTE_NAME, category: 'application_error' });
    return handleApiError(err);
  }
}
