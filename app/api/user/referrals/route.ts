import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserService } from '@/lib/services/user.service';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await UserService.getOrCreateUser(userId);
    return NextResponse.json({
      referralCount: user?.referralPoints || 0,
      referralPoints: user?.referralPoints || 0,
      referralCode: user?.referralCode || userId
    });
  } catch (error) {
    console.error("[REFERRALS_API_ERROR]", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
