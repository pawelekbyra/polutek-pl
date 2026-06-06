import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { response } = await requireAdminForApi('RESYNC_VIDEO_STATS');
  if (response) return response;

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const [likes, dislikes, views] = await Promise.all([
      prisma.videoLike.count({ where: { videoId } }),
      prisma.videoDislike.count({ where: { videoId } }),
      prisma.videoView.count({ where: { videoId } })
    ]);

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: {
        likesCount: likes,
        dislikesCount: dislikes,
        views: views
      }
    });

    return NextResponse.json({
      success: true,
      videoId,
      likesCount: likes,
      dislikesCount: dislikes,
      views: views
    });
  } catch (error) {
    return handleApiError(error);
  }
}
