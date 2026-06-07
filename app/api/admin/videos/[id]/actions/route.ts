import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { writeAuditLog } from '@/lib/services/audit.service';
import { VideoStatus, AccessTier } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_VIDEO");
  if (response) return response;

  const videoId = params.id;
  const body = await req.json();
  const { userId } = await auth();

  try {
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: {
        title: body.title,
        titleEn: body.titleEn,
        slug: body.slug,
        description: body.description,
        descriptionEn: body.descriptionEn,
        videoUrl: body.videoUrl,
        thumbnailUrl: body.thumbnailUrl,
        tier: body.tier,
        status: body.status,
        isMainFeatured: body.isMainFeatured,
        showInSidebar: body.showInSidebar,
        sidebarOrder: body.sidebarOrder,
        publishedAt: body.status === 'PUBLISHED' && !video.publishedAt ? new Date() : undefined,
      }
    });

    if (body.isMainFeatured) {
        await prisma.video.updateMany({
            where: { id: { not: videoId }, creatorId: video.creatorId },
            data: { isMainFeatured: false }
        });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "VIDEO_UPDATED",
      targetType: "Video",
      targetId: videoId,
      metadata: body
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_ACTION");
    if (response) return response;

    const videoId = params.id;
    const { action, reason } = await req.json();
    const { userId } = await auth();

    try {
        let updated;
        switch (action) {
            case 'publish':
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { status: VideoStatus.PUBLISHED, publishedAt: new Date() }
                });
                break;
            case 'unpublish':
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { status: VideoStatus.DRAFT }
                });
                break;
            case 'archive':
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { status: VideoStatus.ARCHIVED }
                });
                break;
            case 'restore':
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { status: VideoStatus.DRAFT }
                });
                break;
            case 'set-hero':
                const video = await prisma.video.findUnique({ where: { id: videoId } });
                await prisma.video.updateMany({
                    where: { creatorId: video?.creatorId },
                    data: { isMainFeatured: false }
                });
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { isMainFeatured: true, status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC }
                });
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        await writeAuditLog({
            actorUserId: userId,
            action: `VIDEO_${action.toUpperCase()}`,
            targetType: "Video",
            targetId: videoId,
            metadata: { reason }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
