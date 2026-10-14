import { auth } from "@/lib/auth/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { NextRequest, NextResponse } from 'next/server';
import { ChannelLayoutService } from '@/lib/modules/channel';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const currentVideoId = searchParams.get('currentVideoId') || undefined;

  try {
    const actor = userId ? await getActorFromAuth({ allowGuest: true }).catch(() => null) : null;
    const layout = await ChannelLayoutService.getSidebarLayout(userId, currentVideoId, { isStaff: actor?.type === "admin" });
    return NextResponse.json(layout);
  } catch (error) {
    return handleApiError(error);
  }
}
