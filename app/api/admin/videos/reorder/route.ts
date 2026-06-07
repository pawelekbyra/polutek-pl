import { createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { writeAuditLog } from "@/lib/services/audit.service";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("REORDER_ADMIN_VIDEOS");
  if (response) return response;

  try {
    const body = await req.json();
    const { videos } = body; // Array of { id, sidebarOrder, showInSidebar, isMainFeatured }

    if (!Array.isArray(videos)) {
        return NextResponse.json({ error: 'Videos array is required' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
        for (const v of videos) {
            await tx.video.update({
                where: { id: v.id },
                data: {
                    sidebarOrder: v.sidebarOrder,
                    showInSidebar: v.showInSidebar,
                    isMainFeatured: v.isMainFeatured
                }
            });
        }

        const heroVideo = videos.find(v => v.isMainFeatured);
        if (heroVideo) {
            await tx.video.updateMany({
                where: { id: { not: heroVideo.id } },
                data: { isMainFeatured: false }
            });
        }
    });

    await writeAuditLog({
        actorUserId: adminUserId,
        action: "CHANNEL_LAYOUT_UPDATED",
        targetType: "Channel",
        metadata: { updatedCount: videos.length }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
      return handleApiError(error);
  }
}
