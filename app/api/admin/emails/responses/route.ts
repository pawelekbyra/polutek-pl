import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { createScopedLogger } from '@/lib/logger';
import { listInboundEmails, updateInboundEmailStatus } from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { InboundEmailStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId || null);
  const { response } = await requireAdminForApi("GET_ADMIN_EMAIL_RESPONSES");
  if (response) return response;

  const ctx = createAppContext({
      requestId: requestId || undefined,
      actor: { type: 'system', reason: 'Admin Responses Request' }
  });

  const result = await listInboundEmails(ctx);

  if (!result.ok) {
      scopedLogger.error("[GET_ADMIN_EMAIL_RESPONSES_ERROR]", result.error);
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode });
  }

  return NextResponse.json(result.data);
}

export async function PATCH(req: NextRequest) {
    const requestId = req.headers.get('x-request-id');
    const scopedLogger = createScopedLogger(requestId || null);
    const { response } = await requireAdminForApi("PATCH_ADMIN_EMAIL_RESPONSES");
    if (response) return response;

    try {
        const { id, status } = await req.json();

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
        }

        const ctx = createAppContext({
            requestId: requestId || undefined,
            actor: { type: 'system', reason: 'Admin Responses Update' }
        });

        const result = await updateInboundEmailStatus(ctx, id, status as InboundEmailStatus);

        if (!result.ok) {
            scopedLogger.error("[PATCH_ADMIN_EMAIL_RESPONSES_ERROR]", result.error);
            return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode });
        }

        return NextResponse.json(result.data);
    } catch (err) {
        scopedLogger.error("[PATCH_ADMIN_EMAIL_RESPONSES_ERROR]", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
