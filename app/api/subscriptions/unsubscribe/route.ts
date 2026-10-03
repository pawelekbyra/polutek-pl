import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { getCorrelationId } from '@/lib/utils/correlation';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SignedContentUnsubscribeUseCase } from '@/lib/modules/subscriptions';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Unsubscribe endpoint. Public, no session, no CSRF token: it acts only on a signed, user-bound token.
 *
 * - One-click (RFC 8058): the List-Unsubscribe header points here with `?token=`, and the mailbox
 *   provider POSTs `List-Unsubscribe=One-Click`. Answer 200 with no redirect.
 * - The /unsubscribe page posts its form here (token in the body); the browser is sent back to the
 *   page, which shows the result in the recipient's language.
 * - A plain GET (an old client opening the header URL) goes to the confirmation page: a GET never
 *   unsubscribes, because link scanners fetch every URL in a mail.
 */

// Behind the tunnel the request origin can be the local listener; links point at the public site.
function pageUrl(params: Record<string, string>) {
  const url = new URL('/unsubscribe', getBaseUrl());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  return NextResponse.redirect(pageUrl(token ? { token } : {}), 303);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const form = await req.formData().catch(() => null);
  const formToken = form?.get('token');
  const token = typeof formToken === 'string' && formToken ? formToken : req.nextUrl.searchParams.get('token');
  const isOneClick = form?.get('List-Unsubscribe') === 'One-Click';

  const ctx = createAppContext({ actor: { type: 'guest' }, requestId: requestId ?? undefined });
  try {
    const result = await SignedContentUnsubscribeUseCase.execute(ctx, token);
    if (result.status === 'invalid') scopedLogger.warn('[UNSUBSCRIBE] rejected an unsigned or malformed token');

    if (isOneClick) {
      return NextResponse.json({ ok: result.status === 'unsubscribed' }, { status: result.status === 'unsubscribed' ? 200 : 400 });
    }
    return NextResponse.redirect(
      pageUrl(result.status === 'unsubscribed'
        ? { status: 'done', lang: result.language }
        : { status: 'invalid' }),
      303,
    );
  } catch (error) {
    scopedLogger.error('[UNSUBSCRIBE] failed', error instanceof Error ? error.message : String(error));
    if (isOneClick) return NextResponse.json({ ok: false }, { status: 500 });
    return NextResponse.redirect(pageUrl({ status: 'error', ...(token ? { token } : {}) }), 303);
  }
}
