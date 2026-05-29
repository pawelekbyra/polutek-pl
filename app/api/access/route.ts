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
      const authData = auth();
      userId = authData.userId;
  } catch (e) {
      console.warn("[Access] Clerk Handshake failure during access check. Proceeding as guest.");
  }

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const access = await ContentService.getVideoAccess(userId, videoId);
    return NextResponse.json(access);
  } catch (error: any) {
    console.error("[ACCESS_API_ERROR]", error);
    // Extreme fallback: restrict access but don't crash
    return NextResponse.json({
        hasAccess: false,
        userTotalPaid: 0,
        requiredTier: 'PATRON',
        videoUrl: null,
        error: "Access check partially failed. Check DB connectivity."
    });
  }
}
