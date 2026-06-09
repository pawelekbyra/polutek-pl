import { NextRequest, NextResponse } from 'next/server';
import { GET as getComments, POST as postComment } from '../videos/[id]/comments/route';
import { PATCH as patchComment, DELETE as deleteComment } from './[commentId]/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ success: false, message: 'videoId is required' }, { status: 400 });

  return getComments(request, { params: { id: videoId } });
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json();
  const videoId = body.videoId;
  if (!videoId) return NextResponse.json({ success: false, message: 'videoId is required' }, { status: 400 });

  return postComment(request, { params: { id: videoId } });
}

export async function PATCH(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');
    if (!commentId) return NextResponse.json({ success: false, message: 'commentId is required' }, { status: 400 });
    return patchComment(request, { params: { commentId } });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');
    if (!commentId) return NextResponse.json({ success: false, message: 'commentId is required' }, { status: 400 });
    return deleteComment(request, { params: { commentId } });
}
