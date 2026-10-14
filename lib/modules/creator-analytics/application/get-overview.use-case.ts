import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { authorize } from "@/lib/modules/authz";
import { loadOverview } from "../domain/read-models";
import type { AnalyticsOverview } from "../domain/types";
import { channelIdOf, periodOf, repositoryOf } from "./context";

/** Channel summary for a period: views, watch time, average share watched, subscribers, comments, daily series. */
export async function getChannelAnalyticsOverview(
  ctx: AppContext,
  input: { range?: string | number | null },
): Promise<UseCaseResult<AnalyticsOverview, AppError>> {
  const channelId = channelIdOf(ctx);
  if (channelId instanceof AppError) return fail(channelId);
  const denied = await authorize(ctx, "channel.view_analytics", { channelId });
  if (denied) return fail(denied);
  const period = periodOf(ctx, input.range);
  if (period instanceof AppError) return fail(period);
  const overview = await loadOverview(repositoryOf(ctx), channelId, period);
  return overview ? ok(overview) : fail(new AppError("Nie znaleziono kanału.", 404, "NOT_FOUND"));
}
