import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. App response check (implicit)

    // 2. Prisma basic query
    await prisma.$queryRaw`SELECT 1`;

    // 3. Basic content checks
    const approvedCreatorExists = await prisma.creator.findFirst({
        where: { isApproved: true }
    });

    const mainFeaturedVideoExists = await prisma.video.findFirst({
        where: { isMainFeatured: true }
    });

    // 4. Basic env checks (values hidden)
    const env = {
        DATABASE_URL: !!process.env.DATABASE_URL,
        DATABASE_URL_UNPOOLED: !!process.env.DATABASE_URL_UNPOOLED,
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    };

    return NextResponse.json({
        ok: true,
        database: "ok",
        env,
        content: {
            approvedCreatorExists: !!approvedCreatorExists,
            mainFeaturedVideoExists: !!mainFeaturedVideoExists
        }
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
