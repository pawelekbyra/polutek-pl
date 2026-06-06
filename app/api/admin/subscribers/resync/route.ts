import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { response } = await requireAdminForApi('RESYNC_SUBSCRIBERS');
  if (response) return response;

  try {
    const creators = await prisma.creator.findMany({
      select: { id: true }
    });

    const results = await Promise.all(
      creators.map(async (creator) => {
        const realCount = await prisma.subscription.count({
          where: { creatorId: creator.id }
        });
        await prisma.creator.update({
          where: { id: creator.id },
          data: { subscribersCount: realCount }
        });
        return { creatorId: creator.id, subscribersCount: realCount };
      })
    );

    return NextResponse.json({ success: true, updated: results });
  } catch (error) {
    return handleApiError(error);
  }
}
