import { AppContext } from "@/lib/modules/shared/app-context";
import { VideoStatus } from "@prisma/client";
import { buildPublicVideoWhere } from "@/lib/services/content.service";
import { getAllowedMediaHosts } from "@/lib/blob";

export interface HealthCheckResult {
  ok: boolean;
  database?: string;
  env?: Record<string, boolean>;
  content?: {
    allVideosCount: number;
    publishedVideosCount: number;
    visibleVideosCount: number;
    approvedCreatorExists: boolean;
    primaryCreatorExists: boolean;
    mainFeaturedVideoExists: boolean;
    mediaHostsConfigured: boolean;
  };
}

export async function checkHealth(
  ctx: AppContext,
  tokenProvided: string | null | undefined
): Promise<HealthCheckResult> {
  const isAuthorized =
    !!process.env.HEALTHCHECK_TOKEN &&
    tokenProvided === process.env.HEALTHCHECK_TOKEN;

  if (!isAuthorized) {
    return { ok: true };
  }

  // Use ctx.prisma instead of global prisma
  await (ctx.prisma as any).$queryRaw`SELECT 1`;

  const approvedCreatorExists = await ctx.prisma.creator.findFirst({
    where: { isApproved: true },
  });
  const primaryCreatorExists = await ctx.prisma.creator.findFirst({
    where: { isPrimary: true, isApproved: true },
  });

  const publicWhere = await buildPublicVideoWhere();

  const [
    allVideosCount,
    publishedVideosCount,
    visibleVideosCount,
    mainFeaturedVideoExists,
  ] = await Promise.all([
    ctx.prisma.video.count(),
    ctx.prisma.video.count({ where: { status: VideoStatus.PUBLISHED } }),
    ctx.prisma.video.count({ where: publicWhere }),
    ctx.prisma.video.findFirst({
      where: { ...publicWhere, isMainFeatured: true },
    }),
  ]);

  return {
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
    },
  };
}
