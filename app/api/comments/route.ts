import { NextRequest, NextResponse } from 'next/server';
import { GET as getComments } from '../videos/[id]/comments/route';

export const dynamic = 'force-dynamic';

/**
 * Public comment list (`?videoId=`). An alias of `GET /api/videos/[id]/comments` on a path the
 * proxy treats as public. Writes go to `/api/videos/[id]/comments` and `/api/comments/[commentId]`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ success: false, message: 'videoId is required' }, { status: 400 });

  return getComments(request, { params: Promise.resolve({ id: videoId }) });
}
