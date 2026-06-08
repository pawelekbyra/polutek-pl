import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { writeAuditLog } from '@/lib/services/audit.service';
import { VideoStatus, AccessTier } from '@prisma/client';
import { z } from 'zod';
import { MainChannelService } from '@/lib/channel/main-channel.service';
import { isAllowedVideoSourceUrl, isAllowedThumbnailUrl } from '@/lib/blob';

const patchVideoSchema = z.object({
  title: z.string().trim().min(1).optional(),
  titleEn: z.string().trim().optional().nullable(),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  descriptionEn: z.string().trim().optional().nullable(),
  videoUrl: z.string().url().refine(isAllowedVideoSourceUrl, {
    message: "Video URL musi być linkiem YouTube/Vimeo albo plikiem/manifestem z dozwolonego hosta mediów.",
  }).optional(),
  thumbnailUrl: z.string().refine(isAllowedThumbnailUrl, {
    message: "Miniaturka musi być bezpieczną ścieżką lokalną lub pochodzić z dozwolonego hosta obrazków.",
  }).optional(),
  tier: z.nativeEnum(AccessTier).optional(),
  status: z.nativeEnum(VideoStatus).optional(),
  isMainFeatured: z.boolean().optional(),
  showInSidebar: z.boolean().optional(),
  sidebarOrder: z.number().int().optional(),
  publishedAt: z.string().datetime().optional().nullable(),
});

const postActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive', 'restore', 'set-hero']),
  reason: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_VIDEO");
  if (response) return response;

  const videoId = params.id;

  try {
    const rawBody = await req.json();
    const result = patchVideoSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body', details: result.error.flatten() }, { status: 400 });
    }

    const body = result.data;
    const mainChannel = await MainChannelService.getRequired();
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    if (video.creatorId !== mainChannel.id) {
        return NextResponse.json({ error: 'This video does not belong to the main channel. Maintenance required.' }, { status: 403 });
    }

    const updateData: any = { ...body };

    if (body.status === 'PUBLISHED' && !video.publishedAt && !body.publishedAt) {
        updateData.publishedAt = new Date();
    }

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: updateData
    });

    if (body.isMainFeatured) {
        await prisma.video.updateMany({
            where: { id: { not: videoId }, creatorId: mainChannel.id },
            data: { isMainFeatured: false }
        });
    }

    await writeAuditLog({
      actorUserId: adminUserId,
      action: "VIDEO_UPDATED",
      targetType: "Video",
      targetId: videoId,
      metadata: {
          action: "PATCH_VIDEO",
          changedFields: Object.keys(updateData).filter(k => updateData[k] !== undefined),
          status: updateData.status,
          tier: updateData.tier
      }
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

    try {
        const rawBody = await req.json();
        const result = postActionSchema.safeParse(rawBody);

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid action', details: result.error.flatten() }, { status: 400 });
        }

        const { action, reason } = result.data;
        const mainChannel = await MainChannelService.getRequired();
        const video = await prisma.video.findUnique({ where: { id: videoId } });
        if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

        if (video.creatorId !== mainChannel.id) {
            return NextResponse.json({ error: 'This video does not belong to the main channel. Maintenance required.' }, { status: 403 });
        }

        const previousStatus = video.status;
        const previousIsHero = video.isMainFeatured;

        let updated;
        switch (action) {
            case 'publish':
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { status: VideoStatus.PUBLISHED, publishedAt: video.publishedAt || new Date() }
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
                await prisma.video.updateMany({
                    where: { creatorId: mainChannel.id },
                    data: { isMainFeatured: false }
                });
                updated = await prisma.video.update({
                    where: { id: videoId },
                    data: { isMainFeatured: true, status: VideoStatus.PUBLISHED, tier: AccessTier.PUBLIC }
                });
                break;
        }

        await writeAuditLog({
            actorUserId: adminUserId,
            action: `VIDEO_${action.toUpperCase()}`,
            targetType: "Video",
            targetId: videoId,
            metadata: {
                action,
                reason,
                previousStatus,
                nextStatus: updated?.status,
                previousIsHero,
                nextIsHero: updated?.isMainFeatured
            }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
