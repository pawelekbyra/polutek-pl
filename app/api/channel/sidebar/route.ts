import { auth } from "@/lib/auth/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { NextRequest, NextResponse } from 'next/server';
import { ChannelLayoutService, SIDEBAR_PAGE_SIZE_MAX, type SidebarSectionType } from '@/lib/modules/channel';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const PAGED_SECTIONS: readonly SidebarSectionType[] = ['FREE', 'LOGGED_IN', 'UPCOMING'];

function readInt(value: string | null, max: number): number | undefined {
  if (value === null || !/^\d{1,7}$/.test(value)) return undefined;
  return Math.min(Number(value), max);
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const currentVideoId = searchParams.get('currentVideoId') || undefined;
  // Without `section` every section's first page; with it, the next page of that one section ("More", W03).
  const sectionParam = searchParams.get('section');
  const section = PAGED_SECTIONS.find((candidate) => candidate === sectionParam);
  if (sectionParam && !section) {
    return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  }

  try {
    const actor = userId ? await getActorFromAuth({ allowGuest: true }).catch(() => null) : null;
    const layout = await ChannelLayoutService.getSidebarLayout(userId, currentVideoId, { isStaff: actor?.type === "admin" }, {
      section,
      offset: readInt(searchParams.get('offset'), 1_000_000),
      limit: readInt(searchParams.get('limit'), SIDEBAR_PAGE_SIZE_MAX),
    });
    return NextResponse.json(layout);
  } catch (error) {
    return handleApiError(error);
  }
}
