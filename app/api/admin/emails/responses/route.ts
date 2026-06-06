import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_EMAIL_RESPONSES");
  if (response) return response;

  try {
    const responses = await prisma.inboundEmail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json(responses);
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

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
        }

        const updated = await prisma.inboundEmail.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json(updated);
    } catch (err) {
        scopedLogger.error("[PATCH_ADMIN_EMAIL_RESPONSES_ERROR]", err);
        return handleApiError(err);
    }
}
