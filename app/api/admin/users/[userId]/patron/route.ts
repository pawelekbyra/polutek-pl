import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { grantPatronStatus, revokePatronStatus } from '@/lib/services/patron.service';
import { syncPatronStatusToClerk } from '@/lib/services/patron.service';

type Context = { params: { userId: string } };

function adminErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.code === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden' },
      { status: error.code === 'UNAUTHORIZED' ? 401 : 403 },
    );
  }
  throw error;
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const adminUserId = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'grant') {
      const result = await grantPatronStatus(params.userId, {
        source: 'admin',
        grantedByUserId: adminUserId,
        note: body?.note || 'Granted manually by administrator',
      });
      await syncPatronStatusToClerk(params.userId, true, result.normalizedTotal).catch((error) => {
        console.error('[ADMIN_PATRON_GRANT_CLERK_SYNC_ERROR]', error);
      });
      return NextResponse.json({ isPatron: true, patronSince: result.user.patronSince, patronSource: result.user.patronSource });
    }

    if (action === 'revoke') {
      const result = await revokePatronStatus(params.userId, {
        revokedByUserId: adminUserId,
        note: body?.note || 'Revoked manually by administrator',
      });
      await syncPatronStatusToClerk(params.userId, false, result.normalizedTotal).catch((error) => {
        console.error('[ADMIN_PATRON_REVOKE_CLERK_SYNC_ERROR]', error);
      });
      return NextResponse.json({ isPatron: false, patronSince: null, patronSource: null });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    try {
      return adminErrorResponse(error);
    } catch (unhandled) {
      console.error('[ADMIN_PATRON_PATCH_ERROR]', unhandled);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
