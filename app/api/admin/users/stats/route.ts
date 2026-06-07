import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { UsersAdminService } from '@/lib/services/admin/users-admin.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_USERS_STATS");
  if (response) return response;

  try {
    const stats = await UsersAdminService.getStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_USERS_STATS_ERROR]", error);
      return handleApiError(error);
  }
}
