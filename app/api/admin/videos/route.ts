import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = "pawel.perfect@gmail.com";

async function verifyAdmin() {
  const user = await currentUser();
  if (!user || user.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return false;
  }
  return true;
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    include: { creator: true, _count: { select: { videoLikes: true, videoDislikes: true, comments: true } } }
  });

  return NextResponse.json(videos);
}

export async function POST(req: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, title, slug, description, videoUrl, thumbnailUrl, duration, tier, likesCount, dislikesCount, views, isMainFeatured } = body;

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
            likesCount: parseInt(likesCount) || 0,
            dislikesCount: parseInt(dislikesCount) || 0,
            views: parseInt(views) || 0,
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
            likesCount: parseInt(likesCount) || 0,
            dislikesCount: parseInt(dislikesCount) || 0,
            views: parseInt(views) || 0,
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
  } catch (error: any) {
    console.error("[ADMIN_VIDEO_POST_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
  } catch (error: any) {
    console.error("[ADMIN_VIDEO_DELETE_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
