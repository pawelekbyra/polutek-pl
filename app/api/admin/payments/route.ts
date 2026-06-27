import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { requireAdminForApi } from '@/lib/auth-utils';
import { parsePaymentQueryParams } from '@/lib/api/admin-payments-query';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { listAdminPayments } from '@/lib/modules/payments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi('GET_ADMIN_PAYMENTS');
  if (response) return response;

  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);

  try {
    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId! } });
    const options = parsePaymentQueryParams(req);
    const result = await listAdminPayments(options, ctx);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode ?? 400 });
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    scopedLogger.error("[GET_ADMIN_PAYMENTS_ERROR]", error);
    return handleApiError(error);
  }
}
