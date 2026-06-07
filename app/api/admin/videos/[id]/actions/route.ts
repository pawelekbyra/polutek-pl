import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { writeAuditLog } from '@/lib/services/audit.service';
import { VideoStatus, AccessTier } from '@prisma/client';
import { z } from 'zod';

const patchSchema = z.object({
    title: z.string().min(1).optional(),
    titleEn: z.string().nullable().optional(),
    slug: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    descriptionEn: z.string().nullable().optional(),
    videoUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    tier: z.nativeEnum(AccessTier).optional(),
    status: z.nativeEnum(VideoStatus).optional(),
    isMainFeatured: z.boolean().optional(),
    showInSidebar: z.boolean().optional(),
    sidebarOrder: z.number().int().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_VIDEO");
  if (response) return response;

  const videoId = params.id;
  const json = await req.json();
  const validation = patchSchema.safeParse(json);

  if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
  }

  const body = validation.data;

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
        sidebarOrder: body.sidebarOrder ?? undefined,
        publishedAt: body.status === 'PUBLISHED' && !video.publishedAt ? new Date() : undefined,
      }
    });

    if (body.isMainFeatured) {
        await prisma.video.updateMany({
            where: { id: { not: videoId }, creatorId: video.creatorId },
            data: { isMainFeatured: false }
        });
    }

    // Sanitize metadata for audit log
    const auditMetadata = { ...body };
    // Remove potentially large fields if they didn't change or just to be safe
    delete auditMetadata.description;
    delete auditMetadata.descriptionEn;

    await writeAuditLog({
      actorUserId: adminUserId,
      action: "VIDEO_UPDATED",
      targetType: "Video",
      targetId: videoId,
      metadata: auditMetadata
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const actionSchema = z.object({
    action: z.enum(['publish', 'unpublish', 'archive', 'restore', 'set-hero']),
    reason: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_ACTION");
    if (response) return response;

    const videoId = params.id;
    const json = await req.json();
    const validation = actionSchema.safeParse(json);

    if (!validation.success) {
        return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }

    const { action, reason } = validation.data;

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
            actorUserId: adminUserId,
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
