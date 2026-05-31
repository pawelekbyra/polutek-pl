import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('x-health-token');
    const isAuthorized = authHeader && authHeader === process.env.HEALTHCHECK_TOKEN;

    if (isAuthorized) {
        // Detailed checks for authorized requests
        await prisma.$queryRaw`SELECT 1`;

        const approvedCreatorExists = await prisma.creator.findFirst({
            where: { isApproved: true }
        });

        const primaryCreatorExists = await prisma.creator.findFirst({
            where: { isPrimary: true, isApproved: true }
        });

        const mainFeaturedVideoExists = await prisma.video.findFirst({
            where: {
                isMainFeatured: true,
                status: VideoStatus.PUBLISHED,
                publishedAt: { lte: new Date() }
            }
        });

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
                approvedCreatorExists: !!approvedCreatorExists,
                primaryCreatorExists: !!primaryCreatorExists,
                mainFeaturedVideoExists: !!mainFeaturedVideoExists
            }
        });
    }

    // Minimal public response
    return NextResponse.json({
        ok: true
    });
  } catch (error: any) {
    console.error("[HEALTH_CHECK_ERROR]", error);
    // Even on error, don't leak details publicly
    return NextResponse.json({
        ok: false,
        message: "System diagnostic failed."
    }, { status: 500 });
  }
}
