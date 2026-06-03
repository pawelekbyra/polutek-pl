import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/auth-utils';
import { ADMIN_EMAIL } from '@/lib/constants';
import { ensureVideoPresentationColumns } from '@/lib/db/video-schema-heal';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { AccessTier, VideoStatus } from '@prisma/client';
import { writeAuditLog } from '@/lib/services/audit.service';

export const dynamic = 'force-dynamic';

const videoSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().min(1).max(160),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional().nullable(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().refine((value) => {
    if (value.startsWith("/")) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid URL or local path" }),
  duration: z.string().optional().nullable(),
  tier: z.nativeEnum(AccessTier).default(AccessTier.PUBLIC),
  status: z.nativeEnum(VideoStatus).default(VideoStatus.PUBLISHED),
  isMainFeatured: z.boolean().default(false),
  showInSidebar: z.boolean().default(true),
  sidebarOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const adminCheck = await verifyAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureVideoPresentationColumns();

  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    include: { creator: true, _count: { select: { videoLikes: true, videoDislikes: true, comments: true } } }
  });

  return NextResponse.json(videos);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const result = videoSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 });
  }

  const { id, title, slug, description, videoUrl, thumbnailUrl, duration, tier, status, isMainFeatured, showInSidebar, sidebarOrder } = result.data;

  // Validation: Only PUBLIC and PUBLISHED videos can be main featured
  if (isMainFeatured && (tier !== AccessTier.PUBLIC || status !== VideoStatus.PUBLISHED)) {
    return NextResponse.json({ error: "Only public and published videos can be featured as Hero." }, { status: 400 });
  }

  try {
    await ensureVideoPresentationColumns();

    if (id) {
      const updated = await prisma.$transaction(async (tx) => {
        const currentVideo = await tx.video.findUnique({ where: { id }, select: { publishedAt: true, creatorId: true } });
        const publishedAt = (status === VideoStatus.PUBLISHED && !currentVideo?.publishedAt) ? new Date() : undefined;

        const video = await tx.video.update({
          where: { id },
          data: {
            title,
            slug,
            description,
            videoUrl,
            thumbnailUrl,
            duration,
            tier,
            status,
            publishedAt,
            isMainFeatured: !!isMainFeatured,
            showInSidebar,
            sidebarOrder
          }
        });

        if (isMainFeatured) {
          await tx.video.updateMany({
            where: {
              id: { not: id },
              creatorId: currentVideo?.creatorId
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
        // Find primary creator first
        let creator = await tx.creator.findFirst({ where: { isPrimary: true } });

        if (!creator) {
          // Fallback to polutek slug
          creator = await tx.creator.findUnique({ where: { slug: "polutek" } });
        }

        if (!creator) {
          const user = await tx.user.findFirst({ where: { email: ADMIN_EMAIL } });
          if (!user) throw new Error('Admin user not found in DB. Check ADMIN_EMAIL env.');

          creator = await tx.creator.create({
            data: {
              userId: user.id,
              name: "Paweł Perfect",
              slug: "polutek",
              isApproved: true,
              isPrimary: true,
            }
          });
        } else if (!creator.isApproved) {
          creator = await tx.creator.update({
            where: { id: creator.id },
            data: { isApproved: true },
          });
        }

        const video = await tx.video.create({
          data: {
            creatorId: creator.id,
            title,
            slug,
            description,
            videoUrl,
            thumbnailUrl,
            duration,
            tier: tier || 'PUBLIC',
            status: status || VideoStatus.PUBLISHED,
            publishedAt: status === VideoStatus.PUBLISHED ? new Date() : null,
            isMainFeatured: !!isMainFeatured,
            showInSidebar,
            sidebarOrder
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
    console.error("[ADMIN_VIDEO_POST_ERROR]", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
  }

  try {
    await ensureVideoPresentationColumns();

    const deleted = await prisma.video.delete({
      where: { id }
    });

    await writeAuditLog({
        actorUserId: (await auth()).userId,
        action: "VIDEO_DELETED",
        targetType: "Video",
        targetId: id,
        metadata: { title: deleted.title }
    });

    return NextResponse.json({ success: true, deleted: deleted.title });
  } catch (error: unknown) {
    console.error("[ADMIN_VIDEO_DELETE_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
