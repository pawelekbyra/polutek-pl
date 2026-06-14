import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SignedContentUnsubscribeUseCase } from '@/lib/modules/subscriptions';

export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = { ok: true, message: 'If this link can be processed, content notifications are now disabled.' };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  try {
    const form = await req.formData().catch(() => null);
    const token = form?.get('token');
    const ctx = createAppContext({ actor: { type: 'guest' }, requestId: requestId ?? undefined });
    const result = await SignedContentUnsubscribeUseCase.execute(ctx, typeof token === 'string' ? token : null);
    return NextResponse.json(result);
  } catch {
    scopedLogger.warn('[SIGNED_UNSUBSCRIBE_POST_GENERIC_FAILURE]');
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
