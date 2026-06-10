import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { listInboundEmails, updateInboundEmail } from '@/lib/modules/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_EMAIL_RESPONSES");
  if (response) return response;

  try {
    const ctx = createAppContext({
      actor: { type: 'system', reason: 'Admin Responses Request' }
    });

    const result = await listInboundEmails(ctx);

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error.message, code: result.error.code },
            { status: result.error.statusCode }
        );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    scopedLogger.error("[GET_ADMIN_EMAIL_RESPONSES_ERROR]", err);
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
    const requestId = req.headers.get('x-request-id');
    const scopedLogger = createScopedLogger(requestId);
    const { response } = await requireAdminForApi("PATCH_ADMIN_EMAIL_RESPONSES");
    if (response) return response;

    try {
        const { id, status } = await req.json();

        const ctx = createAppContext({
            actor: { type: 'system', reason: 'Admin Response Update' }
        });

        const result = await updateInboundEmail(ctx, { id, status });

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error.message, code: result.error.code },
                { status: result.error.statusCode }
            );
        }

        return NextResponse.json(result.data);
    } catch (err) {
        scopedLogger.error("[PATCH_ADMIN_EMAIL_RESPONSES_ERROR]", err);
        return handleApiError(err);
    }
}
