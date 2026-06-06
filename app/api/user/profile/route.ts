import { createScopedLogger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true }
    });
    return NextResponse.json(user);
  } catch (error) {
    scopedLogger.error('[USER_PROFILE_API_ERROR]', error);
    return handleApiError(error);
  }
}
