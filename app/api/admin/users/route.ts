import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { SystemRole, PatronGrantSource } from '@prisma/client';
import { UsersAdminService } from '@/lib/services/admin/users-admin.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_USERS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || undefined;
  const role = (searchParams.get('role') as SystemRole) || undefined;
  const isPatron = searchParams.get('isPatron') === 'true' ? true : searchParams.get('isPatron') === 'false' ? false : undefined;
  const patronSource = (searchParams.get('patronSource') as PatronGrantSource) || undefined;
  const isDeleted = searchParams.get('isDeleted') === 'true' ? true : searchParams.get('isDeleted') === 'false' ? false : undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const orderBy = searchParams.get('orderBy') || 'createdAt';
  const orderDir = (searchParams.get('orderDir') as 'asc' | 'desc') || 'desc';

  try {
    const result = await UsersAdminService.getUsers({
      query,
      role,
      isPatron,
      patronSource,
      isDeleted,
      page,
      pageSize,
      orderBy,
      orderDir
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_USERS_ERROR]", error);
      return handleApiError(error);
  }
}
