import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { CommentAccessService } from '@/lib/services/comments/comment-access.service';
import { CommentService } from '@/lib/services/comments/comment.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const canModerateGlobal = await CommentAccessService.canModerate(userId, ""); // Global moderate
  if (!canModerateGlobal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || "";
    const status = searchParams.get('status') as any;

    const comments = await prisma.comment.findMany({
      where: {
        AND: [
            q ? { text: { contains: q, mode: 'insensitive' } } : {},
            status ? { status } : {}
        ]
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, username: true, imageUrl: true, isPatron: true, role: true } },
      }
    });

    const context = { userId, canModerate: true, videoCreatorId: null };
    return NextResponse.json({
      success: true,
      comments: comments.map(c => CommentService.mapToDto(c, context))
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
