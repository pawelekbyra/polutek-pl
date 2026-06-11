import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from "@/lib/logger";
import { handleCloudflareStreamWebhook } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { handleApiError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/utils/correlation';

export async function POST(req: NextRequest) {
  const requestId = getCorrelationId() || 'cf-stream-webhook';
  const scopedLogger = createScopedLogger("CloudflareStreamWebhookRoute");

  const signature = req.headers.get('cf-webhook-signature');
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;

  if (process.env.NODE_ENV === 'production' && !secret) {
    scopedLogger.error("CLOUDFLARE_WEBHOOK_SECRET is required in production.");
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Verification
  if (secret) {
    if (!signature || signature !== secret) {
      scopedLogger.warn("Invalid or missing cf-webhook-signature");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Should be caught by the first check, but just in case
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  try {
    const payload = await req.json();

    // Cloudflare Stream webhooks often have a 'uid' and 'status'
    if (!payload.uid || !payload.status) {
      scopedLogger.warn("Missing uid or status in payload", { payload });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const ctx = createAppContext({ requestId, actor: { type: 'system', reason: 'Cloudflare Stream Webhook' } });
    const result = await handleCloudflareStreamWebhook(payload, ctx);

    if (!result.ok) {
        return handleApiError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    scopedLogger.error('Cloudflare Stream Webhook Route Error:', err);
    return handleApiError(err);
  }
}
