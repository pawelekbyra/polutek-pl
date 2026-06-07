import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CommentModerationService } from '@/lib/services/comments/comment-moderation.service';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await CommentModerationService.hide(params.commentId, userId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
