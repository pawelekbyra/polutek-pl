import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { parsePaymentQueryParams } from '@/lib/api/admin-payments-query';
import { createAppContextFromRequest } from '@/lib/api/app-context-factory';
import { listAdminPayments } from '@/lib/modules/payments';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);

  try {
    const ctx = await createAppContextFromRequest(requestId || undefined);
    const options = parsePaymentQueryParams(req);
    const result = await listAdminPayments(options, ctx);

    if (!result.ok) {
        return NextResponse.json({ error: result.error.message }, { status: result.error.message.includes('Forbidden') ? 403 : 400 });
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_PAYMENTS_ERROR]", error);
      return handleApiError(error);
  }
}
