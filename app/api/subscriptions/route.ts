import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';

export const dynamic = 'force-dynamic';

/**
 * API Route for checking subscription status.
 */
export async function GET(req: NextRequest) {
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

  try {
    const isSubscribed = await UserService.isSubscribed(userId, creatorId);
    return NextResponse.json({ isSubscribed });
  } catch (error: unknown) {
    console.error("[SUBSCRIPTION_GET_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ isSubscribed: false, error: message }, { status: 500 });
  }
}

/**
 * API Route for toggling subscription status.
 */
export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json();
    const { creatorId } = body;

    if (!creatorId) {
      return NextResponse.json({ error: "Creator ID is required" }, { status: 400 });
    }

    const result = await UserService.toggleSubscription(userId, creatorId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[SUBSCRIPTION_POST_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("DATABASE_TABLES_MISSING")) {
        return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
