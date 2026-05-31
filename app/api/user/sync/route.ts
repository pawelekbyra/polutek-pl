import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit user sync to prevent Clerk API abuse
    const rateLimitResult = await rateLimit({
      key: `user-sync:${userId}`,
      limit: 5,
      windowMs: 60 * 1000
    });

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const user = await UserService.getOrCreateUser(userId);
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      totalPaid: user.totalPaidMinor / 100,
      isPatron: user.isPatron,
      language: user.language
    });
  } catch (error) {
    return handleApiError(error);
  }
}
