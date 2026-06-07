import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { PaymentStatus } from '@prisma/client';
import { PaymentsAdminService } from '@/lib/services/admin/payments-admin.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_PAYMENTS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q') || undefined;
  const status = (searchParams.get('status') as PaymentStatus) || undefined;
  const currency = searchParams.get('currency') || undefined;
  const refundedOnly = searchParams.get('refundedOnly') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const orderBy = searchParams.get('orderBy') || 'createdAt';
  const orderDir = (searchParams.get('orderDir') as 'asc' | 'desc') || 'desc';

  try {
    const result = await PaymentsAdminService.getPayments({
      search,
      status,
      currency,
      refundedOnly,
      page,
      pageSize,
      orderBy,
      orderDir
    });

    const stats = await PaymentsAdminService.getFinancialStats();

    return NextResponse.json({
        ...result,
        stats
    });
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_PAYMENTS_ERROR]", error);
      return handleApiError(error);
  }
}
