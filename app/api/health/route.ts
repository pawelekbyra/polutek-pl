import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { buildPublicVideoWhere } from '@/lib/services/content.service';
import { getAllowedMediaHosts } from '@/lib/blob';

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

    const [allVideosCount, publishedVideosCount, visibleVideosCount, mainFeaturedVideoExists] = await Promise.all([
        prisma.video.count(),
        prisma.video.count({ where: { status: VideoStatus.PUBLISHED } }),
        prisma.video.count({ where: buildPublicVideoWhere() }),
        prisma.video.findFirst({
            where: {
                ...buildPublicVideoWhere(),
                isMainFeatured: true,
            }
        }),
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
            allVideosCount,
            publishedVideosCount,
            visibleVideosCount,
            approvedCreatorExists: !!approvedCreatorExists,
            primaryCreatorExists: !!primaryCreatorExists,
            mainFeaturedVideoExists: !!mainFeaturedVideoExists,
            mediaHostsConfigured: getAllowedMediaHosts().size > 0,
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
