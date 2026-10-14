import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { authorize } from "@/lib/modules/authz";
import { loadVideoDetail } from "../domain/read-models";
import type { VideoDetail } from "../domain/types";
import { channelIdOf, periodOf, repositoryOf } from "./context";

/**
 * One video of the context channel with its daily series, reach curve and viewer-type split. A video of another
 * channel is "not found", exactly like a missing one (the query itself is scoped to the channel).
 */
export async function getChannelVideoDetail(
  ctx: AppContext,
  input: { videoId: string; range?: string | number | null },
): Promise<UseCaseResult<VideoDetail, AppError>> {
  const channelId = channelIdOf(ctx);
  if (channelId instanceof AppError) return fail(channelId);
  const denied = await authorize(ctx, "channel.view_analytics", { channelId });
  if (denied) return fail(denied);
  const period = periodOf(ctx, input.range);
  if (period instanceof AppError) return fail(period);
  const detail = await loadVideoDetail(repositoryOf(ctx), channelId, input.videoId, period);
  return detail ? ok(detail) : fail(new AppError("Nie znaleziono filmu.", 404, "NOT_FOUND"));
}
