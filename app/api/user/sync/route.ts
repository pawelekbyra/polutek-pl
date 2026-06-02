import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure user exists
    await UserService.getOrCreateUser(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      totalPaid: 0,
      isPatron: user.isPatron,
      language: user.language
    });
  } catch (error) {
    console.error('[USER_SYNC_API_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
