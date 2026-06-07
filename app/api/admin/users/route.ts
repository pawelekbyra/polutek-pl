import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { UsersAdminService } from '@/lib/services/admin/users-admin.service';
import { handleApiError } from '@/lib/errors';
import { parseUserQueryParams } from '@/lib/services/admin/admin-query-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_USERS");
  if (response) return response;

  const options = parseUserQueryParams(req);

  try {
    const result = await UsersAdminService.getUsers(options);

    return NextResponse.json(result);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_USERS_ERROR]", error);
      return handleApiError(error);
  }
}
