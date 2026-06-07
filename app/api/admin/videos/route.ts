import { logger, createScopedLogger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { AccessTier, Prisma, VideoStatus } from '@prisma/client';
import { writeAuditLog } from '@/lib/services/audit.service';
import { flags } from '@/lib/feature-flags';
import { MainCreatorService } from '@/lib/services/main-creator.service';
import { isAllowedVideoSourceUrl, isAllowedThumbnailUrl } from '@/lib/blob';
import { handleApiError } from '@/lib/errors';
import { VideosAdminService } from '@/lib/services/admin/videos-admin.service';

export const dynamic = 'force-dynamic';

const videoSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().min(1).max(160),
  titleEn: z.string().max(160).optional().nullable(),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional().nullable(),
  descriptionEn: z.string().max(5000).optional().nullable(),
  videoUrl: z.string().url().refine(isAllowedVideoSourceUrl, {
    message: "Video URL musi być linkiem YouTube/Vimeo albo plikiem/manifestem z dozwolonego hosta mediów.",
  }),
  thumbnailUrl: z.string().refine(isAllowedThumbnailUrl, {
    message: "Miniaturka musi być bezpieczną ścieżką lokalną lub pochodzić z dozwolonego hosta obrazków.",
  }),
  duration: z.string().optional().nullable(),
  tier: z.nativeEnum(AccessTier).default(AccessTier.PUBLIC),
  status: z.nativeEnum(VideoStatus).default(VideoStatus.PUBLISHED),
  isMainFeatured: z.boolean().default(false),
  showInSidebar: z.boolean().default(true),
  sidebarOrder: z.number().int().default(0),
  likesCount: z.number().int().optional(),
  dislikesCount: z.number().int().optional(),
  views: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_VIDEOS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || undefined;
  const status = (searchParams.get('status') as VideoStatus) || undefined;
  const tier = (searchParams.get('tier') as AccessTier) || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const orderBy = searchParams.get('orderBy') || 'createdAt';
  const orderDir = (searchParams.get('orderDir') as 'asc' | 'desc') || 'desc';

  try {
    const mainCreator = flags.multiCreator
      ? null
      : await prisma.$transaction((tx) =>
          MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, { repairSingleChannelContent: true })
        );

    const result = await VideosAdminService.getVideos({
      query,
      status,
      tier,
      page,
      pageSize,
      orderBy,
      orderDir
    }, mainCreator?.id);

    return NextResponse.json(result);
  } catch (error: unknown) {
      scopedLogger.error("[GET_ADMIN_VIDEOS_ERROR]", error);
      return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEOS");
  if (response) return response;

  try {
    const body = await req.json();
    const result = videoSchema.safeParse(body);

    if (!result.success) {
      const flattened = result.error.flatten();
      const errorMessages = Object.entries(flattened.fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('; ');

      return NextResponse.json({
        error: 'Błędne dane w formularzu',
        details: flattened,
        message: errorMessages
      }, { status: 400 });
    }

    const {
      id, title, titleEn, slug, description, descriptionEn,
      videoUrl, thumbnailUrl, duration, tier, status,
      isMainFeatured, showInSidebar, sidebarOrder,
      likesCount, dislikesCount, views
    } = result.data;

    // Validation: Only PUBLIC and PUBLISHED videos can be main featured
    if (isMainFeatured && (tier !== AccessTier.PUBLIC || status !== VideoStatus.PUBLISHED)) {
      return NextResponse.json({ error: "Only public and published videos can be featured as Hero. Tylko publiczne i opublikowane filmy mogą być wyróżnione jako Hero." }, { status: 400 });
    }

    if (id) {
      const updated = await prisma.$transaction(async (tx) => {
        const mainCreator = flags.multiCreator
          ? null
          : await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, { repairSingleChannelContent: true });
        const currentVideo = await tx.video.findUnique({ where: { id }, select: { publishedAt: true, creatorId: true } });
        if (!currentVideo) {
          throw new Error('Nie znaleziono filmu do aktualizacji.');
        }

        const targetCreatorId = mainCreator?.id || currentVideo.creatorId;
        const publishedAt = (status === VideoStatus.PUBLISHED && !currentVideo.publishedAt) ? new Date() : undefined;

        const video = await tx.video.update({
          where: { id },
          data: {
            creatorId: targetCreatorId,
            title,
            titleEn,
            slug,
            description,
            descriptionEn,
            videoUrl,
            thumbnailUrl,
            duration,
            tier,
            status,
            publishedAt,
            isMainFeatured: !!isMainFeatured,
            showInSidebar,
            sidebarOrder,
            likesCount,
            dislikesCount,
            views
          }
        });

        if (isMainFeatured) {
          await tx.video.updateMany({
            where: {
              id: { not: id },
              creatorId: targetCreatorId
            },
            data: { isMainFeatured: false }
          });
        }
        return video;
      });

      await writeAuditLog({
          actorUserId: (await auth()).userId,
          action: "VIDEO_UPDATED",
          targetType: "Video",
          targetId: id,
          metadata: { title, status, tier, isMainFeatured }
      });

      return NextResponse.json(updated);
    } else {
      const created = await prisma.$transaction(async (tx) => {
        const creator = flags.multiCreator
          ? await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx)
          : await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, { repairSingleChannelContent: true });

        const video = await tx.video.create({
          data: {
            creatorId: creator.id,
            title,
            titleEn,
            slug,
            description,
            descriptionEn,
            videoUrl,
            thumbnailUrl,
            duration,
            tier: tier || 'PUBLIC',
            status: status || VideoStatus.PUBLISHED,
            publishedAt: status === VideoStatus.PUBLISHED ? new Date() : null,
            isMainFeatured: !!isMainFeatured,
            showInSidebar,
            sidebarOrder,
            likesCount: likesCount || 0,
            dislikesCount: dislikesCount || 0,
            views: views || 0
          }
        });

        if (isMainFeatured) {
          await tx.video.updateMany({
            where: {
              id: { not: video.id },
              creatorId: creator.id
            },
            data: { isMainFeatured: false }
          });
        }
        return video;
      });

      await writeAuditLog({
          actorUserId: (await auth()).userId,
          action: "VIDEO_CREATED",
          targetType: "Video",
          targetId: created.id,
          metadata: { title, status, tier, isMainFeatured }
      });

      return NextResponse.json(created);
    }
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_VIDEO_POST_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("DELETE_ADMIN_VIDEOS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
  }

  try {
    // Soft-delete by setting status to ARCHIVED
    const archived = await prisma.video.update({
      where: { id },
      data: { status: VideoStatus.ARCHIVED }
    });

    await writeAuditLog({
        actorUserId: (await auth()).userId,
        action: "VIDEO_ARCHIVED",
        targetType: "Video",
        targetId: id,
        metadata: { title: archived.title, originalAction: "DELETE_REQUEST" }
    });

    return NextResponse.json({ success: true, archived: archived.title, status: 'ARCHIVED' });
  } catch (error: unknown) {
    scopedLogger.error("[ADMIN_VIDEO_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}
