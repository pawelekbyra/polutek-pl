import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { grantPatronStatus, revokePatronStatus } from '@/lib/services/patron.service';
import { syncPatronStatusToClerk } from '@/lib/services/patron.service';
import { handleApiError } from "@/lib/errors";

type Context = { params: { userId: string } };

export async function PATCH(request: NextRequest, { params }: Context) {
  const requestId = request.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_USER_PATRON");
  if (response) return response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    const reason = (body?.reason || body?.note || "").trim();

    if (!reason) {
        return NextResponse.json({ error: 'Reason is required for manual patron status change.' }, { status: 400 });
    }

    if (action === 'grant') {
      const result = await grantPatronStatus(params.userId, {
        source: 'admin',
        grantedByUserId: adminUserId!,
        note: reason,
      });
      await syncPatronStatusToClerk(params.userId, true, result.normalizedTotal).catch((error) => {
        scopedLogger.error('[ADMIN_PATRON_GRANT_CLERK_SYNC_ERROR]', error);
      });
      return NextResponse.json({ isPatron: true, patronSince: result.user.patronSince, patronSource: result.user.patronSource });
    }

    if (action === 'revoke') {
      const result = await revokePatronStatus(params.userId, {
        revokedByUserId: adminUserId!,
        note: reason,
      });
      await syncPatronStatusToClerk(params.userId, false, result.normalizedTotal).catch((error) => {
        scopedLogger.error('[ADMIN_PATRON_REVOKE_CLERK_SYNC_ERROR]', error);
      });
      return NextResponse.json({ isPatron: false, patronSince: null, patronSource: null });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    scopedLogger.error('[ADMIN_PATRON_PATCH_ERROR]', error);
    return handleApiError(error);
  }
}
