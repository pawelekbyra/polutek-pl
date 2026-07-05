import { AppContext } from "@/lib/modules/shared/app-context";
import { fail, ok, UseCaseResult } from "@/lib/modules/shared/result";
import { VideoNotFoundError } from "../domain/video.errors";
import { AdminVideoMediaDto, buildAdminVideoMediaDto } from "./video-media-state.dto";

export type GetAdminVideoMediaStateInput = {
  videoId: string;
};

export async function getAdminVideoMediaState(
  input: GetAdminVideoMediaStateInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoMediaDto, VideoNotFoundError>> {
  const video = await ctx.prisma.video.findUnique({
    where: { id: input.videoId },
    include: {
      activeOriginal: true,
      originals: { orderBy: { version: "desc" } },
      activePlaybackRoute: { include: { asset: true } },
      assets: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      distributionPlans: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          targets: {
            orderBy: { createdAt: "asc" },
            include: {
              providerAssets: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }], take: 1 },
              providerJobs: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!video) return fail(new VideoNotFoundError(input.videoId));

  return ok(
    buildAdminVideoMediaDto({
      videoId: video.id,
      activeOriginal: video.activeOriginal,
      originals: video.originals,
      activePlan: video.distributionPlans[0] ?? null,
      activeRoute: video.activePlaybackRoute,
      legacyAssets: video.assets,
    }),
  );
}
