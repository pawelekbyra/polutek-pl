import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { PaymentsAdminService } from '@/lib/services/admin/payments-admin.service';
import { handleApiError } from '@/lib/errors';
import { parsePaymentQueryParams } from '@/lib/services/admin/admin-query-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_PAYMENTS");
  if (response) return response;

  const options = parsePaymentQueryParams(req);

  try {
    const result = await PaymentsAdminService.getPayments(options);

    return NextResponse.json(result);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_PAYMENTS_ERROR]", error);
      return handleApiError(error);
  }
}
