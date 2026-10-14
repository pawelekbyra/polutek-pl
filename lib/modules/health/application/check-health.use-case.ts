import { AppContext } from "@/lib/modules/shared/app-context";
import { VideoStatus } from "@prisma/client";
import { MediaPolicy } from "@/lib/modules/media";
import { isHealthTokenValue } from "@/lib/api/health-token";
import { MainChannelService, MainChannelPolicy, publiclyVisibleChannelWhere } from "@/lib/modules/channel";

export interface HealthCheckResult {
  ok: boolean;
  database?: string;
  env?: Record<string, boolean>;
  content?: {
    allVideosCount: number;
    publishedVideosCount: number;
    visibleVideosCount: number;
    publicCreatorExists: boolean;
    mainChannelPublic: boolean;
    mainFeaturedVideoExists: boolean;
    mediaHostsConfigured: boolean;
  };
}

export async function checkHealth(
  ctx: AppContext,
  tokenProvided: string | null | undefined
): Promise<HealthCheckResult> {
  const isAuthorized = isHealthTokenValue(tokenProvided);

  if (!isAuthorized) {
    return { ok: true };
  }

  try {
    await (ctx.prisma as any).$queryRaw`SELECT 1`;
  } catch (e) {
      return { ok: false, database: "failed" };
  }

  const publicCreatorExists = await ctx.prisma.creator.findFirst({
    where: publiclyVisibleChannelWhere(),
    select: { id: true },
  });

  const mainChannel = await MainChannelService.getOptional(ctx);
  const mainChannelPublic = !!mainChannel && MainChannelPolicy.isPubliclyVisible(mainChannel);
  const publicWhere = {
    status: VideoStatus.PUBLISHED,
    creatorId: mainChannel?.id || 'none',
    creator: publiclyVisibleChannelWhere(),
    ...MediaPolicy.visiblePublishedAtFilter(ctx.now()),
  };

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
      BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    content: {
      allVideosCount,
      publishedVideosCount,
      visibleVideosCount,
      publicCreatorExists: !!publicCreatorExists,
      mainChannelPublic,
      mainFeaturedVideoExists: !!mainFeaturedVideoExists,
      mediaHostsConfigured: MediaPolicy.getAllowedMediaHosts(process.env).size > 0,
    },
  };
}
