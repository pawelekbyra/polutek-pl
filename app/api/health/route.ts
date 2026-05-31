import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { buildMainFeaturedVideoWhere, buildVisibleVideoWhere } from '@/lib/services/content.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('x-health-token');
  const isAuthorized = !!process.env.HEALTHCHECK_TOKEN && authHeader === process.env.HEALTHCHECK_TOKEN;

  if (!isAuthorized) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    const approvedCreatorExists = await prisma.creator.findFirst({
        where: { isApproved: true }
    });

    const primaryCreatorExists = await prisma.creator.findFirst({
        where: { isPrimary: true, isApproved: true }
    });

    const [allVideoCount, publishedVideoCount, visibleVideoCount, mainFeaturedVideoExists] = await Promise.all([
        prisma.video.count(),
        prisma.video.count({ where: { status: VideoStatus.PUBLISHED } }),
        prisma.video.count({ where: buildVisibleVideoWhere() }),
        prisma.video.findFirst({ where: buildMainFeaturedVideoWhere() }),
    ]);

    return NextResponse.json({
        ok: true,
        database: "ok",
        env: {
            DATABASE_URL: !!process.env.DATABASE_URL,
            DATABASE_URL_UNPOOLED: !!process.env.DATABASE_URL_UNPOOLED,
            CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
            STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
            STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
        },
        content: {
            allVideoCount,
            publishedVideoCount,
            visibleVideoCount,
            approvedCreatorExists: !!approvedCreatorExists,
            primaryCreatorExists: !!primaryCreatorExists,
            mainFeaturedVideoExists: !!mainFeaturedVideoExists,
            mediaHostsConfigured: Boolean(
                process.env.MEDIA_BUCKET_HOST ||
                process.env.NEXT_PUBLIC_R2_PUBLIC_HOST ||
                process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST ||
                process.env.ALLOWED_MEDIA_HOSTS
            ),
        }
    });
  } catch (error) {
    console.error("[HEALTH_CHECK_ERROR]", error);
    return NextResponse.json({
        ok: false,
        database: "error",
        message: "System is having trouble connecting to the database or internal services."
    }, { status: 500 });
  }
}
