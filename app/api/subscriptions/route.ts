import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * API Route for checking subscription status.
 */
export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
          const authData = await auth();
        userId = authData.userId;
    } catch (e) {
        return NextResponse.json({ isSubscribed: false, error: "Handshake failed" });
    }

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('creatorId');

    if (!userId || !creatorId) {
      return NextResponse.json({ isSubscribed: false });
    }

    const isSubscribed = await UserService.isSubscribed(userId, creatorId);
    return NextResponse.json({ isSubscribed });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * API Route for toggling subscription status.
 */
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
          const authData = await auth();
        userId = authData.userId;
    } catch (e) {
        return NextResponse.json({ error: "Handshake Error" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting for subscription toggle
    const rateLimitResult = await rateLimit({
      key: `subscription-toggle:${userId}`,
      limit: 10,
      windowMs: 60 * 1000
    });

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { creatorId } = body;

    if (!creatorId) {
      return NextResponse.json({ error: "Creator ID is required" }, { status: 400 });
    }

    const result = await UserService.toggleSubscription(userId, creatorId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
