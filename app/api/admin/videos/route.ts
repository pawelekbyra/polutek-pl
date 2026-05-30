import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/auth-utils';
import { ADMIN_EMAIL } from '@/lib/constants';
import { z } from 'zod';
import { AccessTier } from '@prisma/client';

export const dynamic = 'force-dynamic';

const videoSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional().nullable(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
  duration: z.string().optional().nullable(),
  tier: z.nativeEnum(AccessTier).default(AccessTier.PUBLIC),
  likesCount: z.union([z.number(), z.string()]).transform(v => parseInt(v.toString()) || 0).default(0),
  dislikesCount: z.union([z.number(), z.string()]).transform(v => parseInt(v.toString()) || 0).default(0),
  views: z.union([z.number(), z.string()]).transform(v => parseInt(v.toString()) || 0).default(0),
  isMainFeatured: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { id, title, slug, description, videoUrl, thumbnailUrl, duration, tier, likesCount, dislikesCount, views, isMainFeatured } = result.data;

  try {
    if (id) {
      const updated = await prisma.$transaction(async (tx) => {
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
            likesCount,
            dislikesCount,
            views,
            isMainFeatured: !!isMainFeatured
          }
        });

        if (isMainFeatured) {
          await tx.video.updateMany({
            where: { id: { not: id } },
            data: { isMainFeatured: false }
          });
        }
        return video;
      });

      return NextResponse.json(updated);
    } else {
      const created = await prisma.$transaction(async (tx) => {
        let creator = await tx.creator.findFirst();
        if (!creator) {
          const user = await tx.user.findFirst({ where: { email: ADMIN_EMAIL } });
          if (!user) throw new Error('Admin user not found in DB.');

          creator = await tx.creator.create({
            data: {
              userId: user.id,
              name: "POLUTEK.PL",
              slug: "polutek",
            }
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
            likesCount,
            dislikesCount,
            views,
            isMainFeatured: !!isMainFeatured
          }
        });

        if (isMainFeatured) {
          await tx.video.updateMany({
            where: { id: { not: video.id } },
            data: { isMainFeatured: false }
          });
        }
        return video;
      });

      return NextResponse.json(created);
    }
  } catch (error: unknown) {
    console.error("[ADMIN_VIDEO_POST_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
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
    const deleted = await prisma.video.delete({
      where: { id }
    });
    return NextResponse.json(deleted);
  } catch (error: unknown) {
    console.error("[ADMIN_VIDEO_DELETE_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
