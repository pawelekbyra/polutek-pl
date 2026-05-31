import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // 1. App response check (implicit)

    // 2. Check for authorization for detailed health checks
    const authHeader = req.headers.get('x-health-token');
    const isAuthorized = process.env.HEALTHCHECK_TOKEN && authHeader === process.env.HEALTHCHECK_TOKEN;

    if (isAuthorized) {
        // Detailed checks only when authorized
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

    // Default public response (no DB query)
    return NextResponse.json({
        ok: true
    });
  } catch (error: any) {
    console.error("[HEALTH_CHECK_ERROR]", error);
    return NextResponse.json({
        ok: false,
        database: "error",
        message: "System is having trouble connecting to the database or internal services."
    }, { status: 500 });
  }
}
