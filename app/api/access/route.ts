import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content.service';

export const dynamic = 'force-dynamic';

/**
 * API Route for checking video access.
 * RESILIENCE: Never returns a 500 error; falls back to restricted access on DB failure.
 */
export async function GET(req: NextRequest) {
  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch (e) {
      console.warn("[Access] Clerk Handshake failure during access check. Proceeding as guest.");
  }

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({
      error: 'INVALID_INPUT',
      message: 'Video ID is required'
    }, { status: 400 });
  }

  try {
    const { hasAccess, requiredTier, reason } = await ContentService.getVideoAccess(userId, videoId);
    return NextResponse.json({ hasAccess, requiredTier, reason });
  } catch (error: unknown) {
    console.error("[ACCESS_API_ERROR]", error);
    // Extreme fallback: restrict access but don't crash
    return NextResponse.json({
        hasAccess: false,
        requiredTier: 'PATRON',
        reason: 'SYSTEM_ERROR',
        message: "Wystąpił błąd podczas sprawdzania dostępu."
    });
  }
}
