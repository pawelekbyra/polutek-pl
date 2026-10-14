import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { authorize } from "@/lib/modules/authz";
import { loadVideoList } from "../domain/read-models";
import type { AnalyticsVideoList } from "../domain/types";
import { channelIdOf, periodOf, repositoryOf } from "./context";

/** Per-video table of the channel for a period (views, watch time, average share, comments, likes). */
export async function getChannelVideoAnalytics(
  ctx: AppContext,
  input: { range?: string | number | null },
): Promise<UseCaseResult<AnalyticsVideoList, AppError>> {
  const channelId = channelIdOf(ctx);
  if (channelId instanceof AppError) return fail(channelId);
  const denied = await authorize(ctx, "channel.view_analytics", { channelId });
  if (denied) return fail(denied);
  const period = periodOf(ctx, input.range);
  if (period instanceof AppError) return fail(period);
  return ok(await loadVideoList(repositoryOf(ctx), channelId, period));
}
